// =====================================================================
// SharedMemoryAtomicsPage.js —— 共享内存与原子操作实验室
// 演示 MDN：
//   1. SharedArrayBuffer + Atomics —— 跨 Worker 共享内存与原子操作（load/store/add/sub/exchange/CAS）
//   2. Atomics.wait / Atomics.notify —— 线程间同步原语（同线程模拟）
//   3. ArrayBuffer 增强（ES2024）—— resizable / maxByteLength / grow / resize / transfer / detached
//   4. WeakRef + FinalizationRegistry —— 弱引用与垃圾回收回调
//   5. 可转移对象（Transferable Objects）—— structuredClone + transfer，转移后原对象 detached
// 说明：SharedArrayBuffer 需 crossOriginIsolated 环境（COOP/COEP）；Atomics.wait 主线程只能 timeout=0。
//       所有 API 调用前做 typeof 能力检测，不可用时仅 _addLog('warn', ...)，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class SharedMemoryAtomicsPage extends Page {
  // —— 初始 state（logs + capsSummary + 6 张 Card 的状态字段）——
  initialState() {
    return {
      logs: [], capsSummary: '',
      sabInfo: '', atomicsInfo: '', waitNotifyInfo: '',
      resizableInfo: '', weakRefInfo: '', transferInfo: '',
      sharedStructsInfo: '',  // Card 9：Shared Structs 跨 Worker 共享对象
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）：Card1 SAB+视图+可增长SAB，Card2 Atomics 视图，Card3 wait 视图，Card4 可调整 AB，Card5 WeakRef+注册表+计数，Card6 转移 AB
    this._sab = null;
    this._view = this._sabGrowable = null;
    this._atomicsSab = this._atomicsView = null;
    this._waitSab = this._waitView = null;
    this._resizableAb = null;
    this._weakRef = this._finalizationRegistry = null;
    this._registryCallbackCount = 0;
    this._transferAb = null;

    // 一次性能力检测：SharedArrayBuffer / Atomics / ArrayBuffer 增强 / WeakRef / FinalizationRegistry
    const hasSAB = typeof SharedArrayBuffer !== 'undefined';
    const hasAtomics = typeof Atomics !== 'undefined';
    const hasCrossIsolated = typeof self !== 'undefined' && self.crossOriginIsolated === true;
    const hasResizable = 'resizable' in ArrayBuffer.prototype ||
      'maxByteLength' in ArrayBuffer.prototype;
    const hasTransfer = typeof ArrayBuffer.prototype.transfer === 'function';
    const hasTransferToFixed = typeof ArrayBuffer.prototype.transferToFixedLength === 'function';
    const hasDetached = 'detached' in ArrayBuffer.prototype;
    const hasWeakRef = typeof WeakRef !== 'undefined';
    const hasFinalization = typeof FinalizationRegistry !== 'undefined';
    const hasStructuredClone = typeof structuredClone === 'function';

    const parts = [
      `SharedArrayBuffer ${hasSAB ? '✓' : '✗'}`,
      `Atomics ${hasAtomics ? '✓' : '✗'}`,
      `crossOriginIsolated ${hasCrossIsolated ? '✓' : '✗'}`,
      `resizable ArrayBuffer ${hasResizable ? '✓' : '✗'}`,
      `transfer ${hasTransfer ? '✓' : '✗'}`,
      `transferToFixedLength ${hasTransferToFixed ? '✓' : '✗'}`,
      `detached ${hasDetached ? '✓' : '✗'}`,
      `WeakRef ${hasWeakRef ? '✓' : '✗'}`,
      `FinalizationRegistry ${hasFinalization ? '✓' : '✗'}`,
      `structuredClone ${hasStructuredClone ? '✓' : '✗'}`,
    ];

    let summary = '';
    if (hasSAB && hasAtomics) {
      summary = `能力检测：${parts.join(' · ')}。当前环境支持 SharedArrayBuffer 与 Atomics，` +
        (hasCrossIsolated ? '且处于 crossOriginIsolated 环境（COOP/COEP 已配置），可完整演示共享内存。'
          : '但未处于 crossOriginIsolated 环境（部分浏览器要求 COOP/COEP），SharedArrayBuffer 创建可能受限。');
    } else {
      summary = `能力检测：${parts.join('，')}。当前环境 SharedArrayBuffer 或 Atomics 不可用；所有按钮点击仍可触发但仅记日志说明，不会抛异常。`;
    }

    this.setState({ capsSummary: summary });
    this._addLog(hasSAB && hasAtomics ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasCrossIsolated) {
      this._addLog('warn', 'self.crossOriginIsolated = false（或 undefined），SharedArrayBuffer 在部分浏览器需 COOP: same-origin + COEP: require-corp');
    }
    if (!hasResizable) this._addLog('warn', 'ArrayBuffer.prototype.resizable / maxByteLength 不可用（需 Node 20+ 或现代浏览器）');
    if (!hasTransfer) this._addLog('warn', 'ArrayBuffer.prototype.transfer 不可用（需较新运行时）');
    if (!hasWeakRef) this._addLog('warn', 'WeakRef 不可用（需 Node 18+ 或现代浏览器）');
    if (!hasFinalization) this._addLog('warn', 'FinalizationRegistry 不可用（需 Node 18+ 或现代浏览器）');
    const hasSharedStruct = (() => { try { return typeof SharedStruct !== 'undefined' || (typeof window !== 'undefined' && typeof window.SharedStruct !== 'undefined'); } catch { return false; } })();
    if (!hasSharedStruct) this._addLog('warn', 'SharedStruct 不可用（TC39 Stage 3 提案，Chrome behind flag，jsdom 无）');
  }

  componentWillUnmount() {
    // 释放 SharedArrayBuffer / 视图 / ArrayBuffer / WeakRef / FinalizationRegistry 引用，便于 GC
    // 注意：FinalizationRegistry 没有显式销毁 API，置空引用即可让引擎回收
    this._sab = null;
    this._view = this._sabGrowable = null;
    this._atomicsSab = this._atomicsView = null;
    this._waitSab = this._waitView = null;
    this._resizableAb = null;
    this._weakRef = this._finalizationRegistry = null;
    this._transferAb = null;
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
    return {
      sab: typeof SharedArrayBuffer !== 'undefined',
      atomics: typeof Atomics !== 'undefined',
      crossIsolated: typeof self !== 'undefined' && self.crossOriginIsolated === true,
      resizable: 'resizable' in ArrayBuffer.prototype ||
        'maxByteLength' in ArrayBuffer.prototype,
      transfer: typeof ArrayBuffer.prototype.transfer === 'function',
      transferToFixed: typeof ArrayBuffer.prototype.transferToFixedLength === 'function',
      detached: 'detached' in ArrayBuffer.prototype,
      weakRef: typeof WeakRef !== 'undefined',
      finalization: typeof FinalizationRegistry !== 'undefined',
      structuredClone: typeof structuredClone === 'function',
      sharedStruct: (() => { try { return typeof SharedStruct !== 'undefined' || (typeof window !== 'undefined' && typeof window.SharedStruct !== 'undefined'); } catch { return false; } })(),
    };
  }

  // =================== Card 1：SharedArrayBuffer 基础 ===================

  // new SharedArrayBuffer(byteLength) → 跨 Worker 共享的固定长度内存
  // new Int32Array(sab) → 视图；Atomics.load / store / exchange 原子读写
  _createSAB() {
    if (typeof SharedArrayBuffer === 'undefined') {
      this._addLog('warn', 'SharedArrayBuffer 不可用（需 crossOriginIsolated 环境）');
      return;
    }
    try {
      const sab = new SharedArrayBuffer(16);   // 16 字节 = 4 个 Int32
      this._sab = sab;
      const view = new Int32Array(sab);        // 4 个 Int32 槽位
      this._view = view;
      // Atomics.store / load：原子写入与读取
      Atomics.store(view, 0, 42);
      Atomics.store(view, 1, 100);
      const loaded0 = Atomics.load(view, 0);
      const loaded1 = Atomics.load(view, 1);
      this.setState({
        sabInfo:
          `new SharedArrayBuffer(16) → 共享内存 ✓，byteLength = ${sab.byteLength}\n` +
          `new Int32Array(sab) → 视图，length = ${view.length}（每 Int32 占 4 字节）\n` +
          `Atomics.store(view, 0, 42) / store(view, 1, 100) → 原子写入\n` +
          `Atomics.load(view, 0) = ${loaded0}，load(view, 1) = ${loaded1}\n` +
          `说明：SharedArrayBuffer 是跨 Worker 共享的固定长度内存；Atomics 保证读写操作的原子性。`,
      });
      this._addLog('sab', `已创建 SAB：byteLength=${sab.byteLength}，load(0)=${loaded0}，load(1)=${loaded1}`);
    } catch (err) {
      this._addLog('warn', `创建 SharedArrayBuffer 失败：${err.name} - ${err.message}`);
      this.setState({ sabInfo: `创建失败：${err.name} - ${err.message}\n（可能因未配置 COOP/COEP，浏览器拒绝构造 SharedArrayBuffer）` });
    }
  }

  // sab.slice(start, end) → 拷贝出新的 SharedArrayBuffer（注意是拷贝不是视图）
  _sliceSAB() {
    if (typeof SharedArrayBuffer === 'undefined') {
      this._addLog('warn', 'SharedArrayBuffer 不可用');
      return;
    }
    if (!this._sab) {
      this._addLog('warn', '请先点击「创建 SAB」');
      return;
    }
    try {
      const sliced = this._sab.slice(0, 8);   // 拷贝前 8 字节为新 SAB
      const viewOrig = new Int32Array(this._sab);
      const viewSlice = new Int32Array(sliced);
      this.setState({
        sabInfo:
          `sab.slice(0, 8) → 拷贝出新的 SharedArrayBuffer（与原 SAB 独立）\n` +
          `原 SAB byteLength = ${this._sab.byteLength}，Int32[0..3] = [${viewOrig[0]}, ${viewOrig[1]}, ${viewOrig[2]}, ${viewOrig[3]}]\n` +
          `切片 SAB byteLength = ${sliced.byteLength}，Int32[0..1] = [${viewSlice[0]}, ${viewSlice[1]}]\n` +
          `说明：slice 返回新的 SharedArrayBuffer，数据是拷贝（修改切片不影响原 SAB）。`,
      });
      this._addLog('sab', `slice(0,8)：切片 byteLength=${sliced.byteLength}，Int32=[${viewSlice[0]}, ${viewSlice[1]}]`);
    } catch (err) {
      this._addLog('warn', `slice 失败：${err.name} - ${err.message}`);
    }
  }

  // new SharedArrayBuffer(byteLength, { maxByteLength }) + sab.grow(newLength)
  _growSAB() {
    if (typeof SharedArrayBuffer === 'undefined') {
      this._addLog('warn', 'SharedArrayBuffer 不可用');
      return;
    }
    try {
      // 创建可增长的 SAB：初始 8 字节，最大 32 字节
      const sab = new SharedArrayBuffer(8, { maxByteLength: 32 });
      this._sabGrowable = sab;
      const before = sab.byteLength;
      const maxBefore = sab.maxByteLength;
      // grow 到 16 字节
      sab.grow(16);
      const after = sab.byteLength;
      this.setState({
        sabInfo:
          `new SharedArrayBuffer(8, { maxByteLength: 32 }) → 可增长 SAB ✓\n` +
          `创建时：byteLength = ${before}，maxByteLength = ${maxBefore}\n` +
          `sab.grow(16) → 扩容到 ${after} 字节（不能超过 maxByteLength，只能增大）\n` +
          `grow 后：byteLength = ${sab.byteLength}，maxByteLength = ${sab.maxByteLength}（新字节初始化为 0）`,
      });
      this._addLog('grow', `可增长 SAB：${before} → ${after} 字节（max=${maxBefore}）`);
    } catch (err) {
      this._addLog('warn', `grow SAB 失败：${err.name} - ${err.message}（可能不支持可增长 SAB）`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. SharedArrayBuffer 基础',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.sab ? 'success' : 'error' }, caps.sab ? 'SAB ✓' : '不可用'),
        h(Tag, { color: caps.crossIsolated ? 'success' : 'warning' },
          caps.crossIsolated ? 'crossOriginIsolated ✓' : '非隔离'),
        h(Tag, { color: 'primary' }, 'load / store / slice / grow'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new SharedArrayBuffer(byteLength) 创建跨 Worker 共享的固定长度内存；new Int32Array(sab) 等创建视图；Atomics.load(typedArray, index) / Atomics.store(typedArray, index, value) 原子读写；sab.slice(start, end) 拷贝出新 SAB；new SharedArrayBuffer(byteLength, { maxByteLength }) + sab.grow(newLength) 创建可增长 SAB。使用 SharedArrayBuffer 需 crossOriginIsolated 环境（COOP: same-origin + COEP: require-corp）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 SAB', { type: 'primary', size: 'sm', disabled: !caps.sab, onClick: () => this._createSAB() }),
          this._btn('slice 拷贝', { size: 'sm', disabled: !caps.sab, onClick: () => this._sliceSAB() }),
          this._btn('可增长 SAB', { type: 'primary', size: 'sm', disabled: !caps.sab, onClick: () => this._growSAB() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'SharedArrayBuffer 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.sabInfo || '（点击「创建 SAB」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`const sab = new SharedArrayBuffer(16);        // 16 字节
const view = new Int32Array(sab);             // 4 个 Int32 槽位
Atomics.store(view, 0, 42);                   // 原子写入
const v = Atomics.load(view, 0);              // 原子读取 = 42
const growable = new SharedArrayBuffer(8, { maxByteLength: 32 });
growable.grow(16);                            // 扩容（只能增大）
// postMessage(sab, [sab]) —— SharedArrayBuffer 共享不转移`)),
        h(Alert, {
          type: 'warning',
          message: 'SharedArrayBuffer 需 crossOriginIsolated 环境',
          description: '浏览器要求页面配置 COOP: same-origin 与 COEP: require-corp 响应头才能使用 SharedArrayBuffer（防止 Spectre 类侧信道攻击）。本环境（jsdom/Node）是否可用取决于运行时实现；不可用时点击按钮仅记日志说明。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Atomics 原子操作 ===================

  // Atomics.add / sub / and / or / xor / exchange / compareExchange
  _createAtomicsView() {
    if (typeof SharedArrayBuffer === 'undefined' || typeof Atomics === 'undefined') {
      this._addLog('warn', 'SharedArrayBuffer 或 Atomics 不可用');
      return;
    }
    try {
      const sab = new SharedArrayBuffer(16);
      this._atomicsSab = sab;
      const view = new Int32Array(sab);
      this._atomicsView = view;
      Atomics.store(view, 0, 10);
      this.setState({
        atomicsInfo:
          `new SharedArrayBuffer(16) + new Int32Array(sab) → Atomics 演示视图 ✓\n` +
          `Atomics.store(view, 0, 10) → 初始值 10；view.length = ${view.length}，byteLength = ${sab.byteLength}\n` +
          `说明：后续 add/sub/and/or/xor/exchange/compareExchange 都在此视图上操作。`,
      });
      this._addLog('atomics', `已创建 Atomics 视图：store(0, 10)，length=${view.length}`);
    } catch (err) {
      this._addLog('warn', `创建视图失败：${err.name} - ${err.message}`);
    }
  }

  // Atomics 算术/位运算 + exchange/compareExchange/isLockFree（统一演示）
  _atomicsOps() {
    if (typeof Atomics === 'undefined' || !this._atomicsView) {
      this._addLog('warn', 'Atomics 不可用或未创建视图');
      return;
    }
    try {
      const view = this._atomicsView;
      // 算术与位运算（均返回旧值）
      Atomics.store(view, 0, 10);
      const oldAdd = Atomics.add(view, 0, 5), afterAdd = Atomics.load(view, 0);
      const oldSub = Atomics.sub(view, 0, 3), afterSub = Atomics.load(view, 0);
      const oldAnd = Atomics.and(view, 0, 0x0F), afterAnd = Atomics.load(view, 0);
      const oldOr = Atomics.or(view, 0, 0xF0), afterOr = Atomics.load(view, 0);
      const oldXor = Atomics.xor(view, 0, 0xFF), afterXor = Atomics.load(view, 0);
      // exchange / compareExchange（CAS）
      Atomics.store(view, 0, 100);
      const oldEx = Atomics.exchange(view, 0, 200), afterEx = Atomics.load(view, 0);
      const cas1 = Atomics.compareExchange(view, 0, 999, 300);   // 期望 999 不匹配 → 返回当前值
      const cas2 = Atomics.compareExchange(view, 0, 200, 300);   // 期望 200 匹配 → 写入 300
      const lockFree4 = Atomics.isLockFree(4);
      this.setState({
        atomicsInfo:
          `Atomics add/sub/and/or/xor（返回旧值，原子更新）：\n` +
          `store(0,10) → add(5)=旧${oldAdd}/新${afterAdd}，sub(3)=旧${oldSub}/新${afterSub}\n` +
          `and(0x0F)=旧${oldAnd}/新${afterAnd}，or(0xF0)=旧${oldOr}/新${afterOr}，xor(0xFF)=旧${oldXor}/新${afterXor}\n\n` +
          `exchange / compareExchange（CAS）：\n` +
          `store(0,100) → exchange(200)=旧${oldEx}/新${afterEx}（无条件交换）\n` +
          `compareExchange(0,999,300)=${cas1}（期望不匹配，值不变）；compareExchange(0,200,300)=${cas2}（匹配写入 300）\n` +
          `isLockFree(4)=${lockFree4}（4 字节原子操作是否无锁）\n` +
          `说明：add/sub/and/or/xor 是「读-改-写」原子操作；compareExchange 是 CAS 原语（无锁数据结构基础）。`,
      });
      this._addLog('atomics', `add→${afterAdd} sub→${afterSub} or→${afterOr} xor→${afterXor} exchange→${afterEx} CAS→${cas2} isLockFree(4)=${lockFree4}`);
    } catch (err) {
      this._addLog('warn', `Atomics 操作失败：${err.name} - ${err.message}`);
    }
  }

  // 演示原子性 vs 普通操作：Atomics 保证读写不可分割，普通 view[i]++ 可能被中断
  _atomicsVsNormal() {
    if (typeof Atomics === 'undefined' || !this._atomicsView) {
      this._addLog('warn', 'Atomics 不可用或未创建视图');
      return;
    }
    try {
      const view = this._atomicsView;
      Atomics.store(view, 0, 0);
      Atomics.store(view, 1, 0);
      // Atomics.add 累加 1000 次 vs 普通 view[1]++ 累加 1000 次
      for (let i = 0; i < 1000; i++) Atomics.add(view, 0, 1);
      for (let i = 0; i < 1000; i++) view[1] = view[1] + 1;
      const r0 = Atomics.load(view, 0);
      const r1 = view[1];
      this.setState({
        atomicsInfo:
          `原子操作 vs 普通操作（单线程累加 1000 次）：\n` +
          `Atomics.add(view, 0, 1) × 1000 → load(0) = ${r0}\n` +
          `view[1] = view[1] + 1 × 1000 → view[1] = ${r1}\n` +
          `说明：单线程下两者结果相同（均为 1000）；多线程下普通 view[i]++ 是「读-改-写」三步，\n` +
          `  可能被其他线程打断导致丢失更新；Atomics.add 是原子操作保证不丢更新（无锁数据结构基础）。`,
      });
      this._addLog('atomics', `累加对比：Atomics.add→${r0}，普通++→${r1}（单线程相同，多线程 Atomics 才显优势）`);
    } catch (err) {
      this._addLog('warn', `对比失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const ok = caps.sab && caps.atomics;
    const card = new Card({
      title: '2. Atomics 原子操作',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: ok ? 'success' : 'error' }, ok ? 'Atomics ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'add/sub/and/or/xor/exchange/CAS'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Atomics.add/sub/and/or/xor(typedArray, index, value) 都是「读-改-写」原子操作，返回旧值；Atomics.exchange(typedArray, index, value) 无条件交换返回旧值；Atomics.compareExchange(typedArray, index, expectedValue, newValue) 是 CAS 原语，仅当当前值等于 expectedValue 时才写入；Atomics.isLockFree(size) 判断 size 字节原子操作是否无需锁。原子操作保证不可分割，是多线程无锁数据结构的基础。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建视图', { type: 'primary', size: 'sm', disabled: !ok, onClick: () => this._createAtomicsView() }),
          this._btn('原子运算 + CAS', { type: 'primary', size: 'sm', disabled: !ok, onClick: () => this._atomicsOps() }),
          this._btn('原子 vs 普通', { size: 'sm', disabled: !ok, onClick: () => this._atomicsVsNormal() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Atomics 操作结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.atomicsInfo || '（点击「创建视图」开始）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {},
`const view = new Int32Array(new SharedArrayBuffer(16));
Atomics.store(view, 0, 10);
Atomics.add(view, 0, 5);               // 返回旧值 10，新值 15
Atomics.exchange(view, 0, 99);         // 无条件交换为 99
Atomics.compareExchange(view, 0, 99, 100); // CAS：期望 99 则写 100
Atomics.isLockFree(4);                 // true（4 字节原子操作无锁）`)),
        h(Alert, {
          type: 'info',
          message: 'compareExchange 是 CAS 原语',
          description: 'CAS（Compare-And-Swap）是无锁编程的核心：仅当内存值等于期望值时才更新为新值，否则返回当前值。基于 CAS 可构建无锁队列、无锁计数器等并发数据结构，避免锁带来的性能损耗与死锁风险。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Atomics.wait / notify ===================

  // 创建 wait/notify 用的 SAB + 视图
  _createWaitView() {
    if (typeof SharedArrayBuffer === 'undefined' || typeof Atomics === 'undefined') {
      this._addLog('warn', 'SharedArrayBuffer 或 Atomics 不可用');
      return;
    }
    try {
      const sab = new SharedArrayBuffer(8);
      this._waitSab = sab;
      const view = new Int32Array(sab);
      this._waitView = view;
      Atomics.store(view, 0, 0);
      this.setState({
        waitNotifyInfo:
          `new SharedArrayBuffer(8) + new Int32Array(sab) → wait/notify 视图 ✓\n` +
          `Atomics.store(view, 0, 0) → 初始值 0\n` +
          `说明：wait(ta, index, value, timeout) 阻塞直到值≠value 返回 'not-equal'、超时返回 'timed-out'、\n` +
          `  被 notify 唤醒返回 'ok'；notify(ta, index, count) 返回唤醒的 agent 数。`,
      });
      this._addLog('wait', `已创建 wait 视图：store(0, 0)，byteLength=${sab.byteLength}`);
    } catch (err) {
      this._addLog('warn', `创建 wait 视图失败：${err.name} - ${err.message}`);
    }
  }

  // Atomics.wait/notify 同线程模拟：演示 not-equal / timed-out / notify 返回 0
  _waitNotifyDemo() {
    if (typeof Atomics === 'undefined' || !this._waitView) {
      this._addLog('warn', 'Atomics 不可用或未创建视图');
      return;
    }
    try {
      const view = this._waitView;
      const lines = [];
      // 场景 1：store 值 ≠ 期望值 → 立即返回 'not-equal'
      Atomics.store(view, 0, 42);
      const r1 = Atomics.wait(view, 0, 0, 0);   // 期望 0，实际 42 → 'not-equal'
      lines.push(`[not-equal] store(0,42) → wait(0,0,0) 期望 0 不匹配 → '${r1}'`);
      // 场景 2：值匹配 + timeout=0 → 'timed-out'（无 agent notify）
      Atomics.store(view, 0, 7);
      const r2 = Atomics.wait(view, 0, 7, 0);   // 期望 7 匹配，超时 → 'timed-out'
      lines.push(`[timed-out] store(0,7) → wait(0,7,0) 值匹配但无 notify → '${r2}'`);
      // 场景 3：notify 在无 agent 等待时返回 0
      Atomics.store(view, 0, 0);
      const woken = Atomics.notify(view, 0, 1);
      let wokenAll = 0;
      try { wokenAll = Atomics.notify(view, 0, Infinity); } catch (e) { wokenAll = `抛错:${e.name}`; }
      lines.push(`[notify] notify(0,1) 唤醒 ${woken} 个（无 agent 等待）；notify(0,Infinity) 唤醒 ${wokenAll} 个`);
      this.setState({
        waitNotifyInfo:
          `Atomics.wait/notify 同线程模拟（主线程只能 timeout=0）：\n` +
          lines.join('\n') + '\n' +
          `说明：wait 三态返回 'ok'(被 notify)/'not-equal'(值不匹配)/'timed-out'(超时)。\n` +
          `  notify 返回实际唤醒数；同线程无 wait 时返回 0。真正阻塞等待需在 Worker 中调用。`,
      });
      this._addLog('wait', `wait/notify：not-equal='${r1}'，timed-out='${r2}'，notify=${woken}`);
    } catch (err) {
      this._addLog('warn', `wait/notify 失败：${err.name} - ${err.message}（主线程非 0 timeout 会抛 TypeError）`);
      this.setState({ waitNotifyInfo: `wait 抛错：${err.name} - ${err.message}\n（主线程 Atomics.wait 只能用 timeout=0，否则抛 TypeError）` });
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const ok = caps.sab && caps.atomics;
    const card = new Card({
      title: '3. Atomics.wait / notify',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: ok ? 'success' : 'error' }, ok ? 'wait/notify ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '线程同步原语'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Atomics.wait(typedArray, index, value, timeout) 阻塞当前线程：若内存值 ≠ value 立即返回 "not-equal"；超时返回 "timed-out"；被 notify 唤醒返回 "ok"。Atomics.notify(typedArray, index, count) 唤醒在指定位置 wait 的 agent，返回实际唤醒数。注意：主线程只能用 timeout=0（否则抛 TypeError 阻塞 UI），真正阻塞等待需在 Worker 中调用。这是基于共享内存的线程同步原语。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建视图', { type: 'primary', size: 'sm', disabled: !ok, onClick: () => this._createWaitView() }),
          this._btn('wait/notify 演示', { type: 'primary', size: 'sm', disabled: !ok, onClick: () => this._waitNotifyDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'wait/notify 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.waitNotifyInfo || '（点击「创建视图」开始）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`// Worker 中（可阻塞）
const view = new Int32Array(new SharedArrayBuffer(4));
Atomics.store(view, 0, 0);
const r = Atomics.wait(view, 0, 0, 5000); // 阻塞最多 5s
// r: 'ok'(被 notify)/'not-equal'(值不匹配)/'timed-out'(超时)
Atomics.notify(view, 0, 1);  // 唤醒 1 个等待者
// 主线程 Atomics.wait 只能用 timeout=0，否则抛 TypeError`)),
        h(Alert, {
          type: 'warning',
          message: '主线程 Atomics.wait 只能用 timeout=0',
          description: '为防止冻结 UI，规范禁止主线程用非 0 timeout 调用 Atomics.wait（会抛 TypeError）。真正的阻塞等待必须在 Worker 中进行。本卡片用 timeout=0 模拟 wait 的三种返回值：not-equal / timed-out / ok（同线程无法得到 ok，因 notify 时无 agent 在等）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：ArrayBuffer 可调整大小（ES2024）===================

  // new ArrayBuffer(byteLength, { maxByteLength }) + resizable / maxByteLength
  _createResizableAB() {
    if (!('resizable' in ArrayBuffer.prototype) &&
        !('maxByteLength' in ArrayBuffer.prototype)) {
      this._addLog('warn', 'ArrayBuffer 可调整大小（resizable）不可用，需 Node 20+ 或现代浏览器');
      return;
    }
    try {
      // 创建可调整大小的 ArrayBuffer：初始 8 字节，最大 32 字节
      const ab = new ArrayBuffer(8, { maxByteLength: 32 });
      this._resizableAb = ab;
      this.setState({
        resizableInfo:
          `new ArrayBuffer(8, { maxByteLength: 32 }) → 可调整大小 ArrayBuffer ✓\n` +
          `ab.byteLength = ${ab.byteLength}，ab.maxByteLength = ${ab.maxByteLength}，ab.resizable = ${ab.resizable}\n` +
          `说明：ES2024 起 ArrayBuffer 支持 maxByteLength 创建可调整大小缓冲区；resizable 为 true 时可调用 grow/resize（不超过 maxByteLength）。`,
      });
      this._addLog('resizable', `可调整 AB：byteLength=${ab.byteLength}，maxByteLength=${ab.maxByteLength}，resizable=${ab.resizable}`);
    } catch (err) {
      this._addLog('warn', `创建可调整 AB 失败：${err.name} - ${err.message}`);
    }
  }

  // ab.grow(newLength) / ab.resize(newLength)：调整大小
  _growResizeAB() {
    if (!this._resizableAb) {
      this._addLog('warn', '请先点击「创建可调整 AB」');
      return;
    }
    try {
      const ab = this._resizableAb;
      const before = ab.byteLength;
      const lines = [];
      // grow：只能增大，新分配字节初始化为 0
      if (typeof ab.grow === 'function') {
        ab.grow(16);
        lines.push(`ab.grow(16) → byteLength: ${before} → ${ab.byteLength}（grow 只能增大）`);
      } else { lines.push('ab.grow 不可用'); }
      // resize：可增大也可缩小
      if (typeof ab.resize === 'function') {
        ab.resize(24);
        const afterR24 = ab.byteLength;
        ab.resize(12);
        lines.push(`ab.resize(24) → ${afterR24}，resize(12) → ${ab.byteLength}（resize 可增可缩）`);
      } else { lines.push('ab.resize 不可用（部分实现只有 grow）'); }
      this.setState({
        resizableInfo:
          `ab.grow / ab.resize 调整大小：\n` +
          lines.join('\n') + '\n' +
          `当前：byteLength = ${ab.byteLength}，maxByteLength = ${ab.maxByteLength}，resizable = ${ab.resizable}\n` +
          `说明：grow 只能增大且不能超过 maxByteLength；resize 可增可缩。调整大小后基于原 buffer 的 TypedArray 视图会自动反映新长度。`,
      });
      this._addLog('resizable', `grow/resize 后：byteLength=${ab.byteLength}（max=${ab.maxByteLength}）`);
    } catch (err) {
      this._addLog('warn', `grow/resize 失败：${err.name} - ${err.message}`);
    }
  }

  // ab.transfer() / ab.transferToFixedLength() + ab.detached
  _transferAB() {
    if (typeof ArrayBuffer.prototype.transfer !== 'function') {
      this._addLog('warn', 'ArrayBuffer.prototype.transfer 不可用，需较新运行时');
      return;
    }
    try {
      const ab = new ArrayBuffer(8, { maxByteLength: 32 });
      const view = new Int8Array(ab);
      view[0] = 42; view[1] = 99;
      const beforeDetached = ab.detached, beforeByteLength = ab.byteLength;
      // transfer：转移所有权到新 ArrayBuffer，原 buffer detached
      const transferred = ab.transfer();
      const afterDetached = ab.detached, afterByteLength = ab.byteLength;
      const newView = new Int8Array(transferred);
      // transferToFixedLength：转移为固定长度（不可调整）的 ArrayBuffer
      let tflResizable = '不可用';
      if (typeof transferred.transferToFixedLength === 'function') {
        try { tflResizable = transferred.transferToFixedLength().resizable; }
        catch (e) { tflResizable = `抛错:${e.name}`; }
      }
      this.setState({
        resizableInfo:
          `ab.transfer() / transferToFixedLength() + detached：\n` +
          `原 ab: byteLength=${beforeByteLength}，detached=${beforeDetached}，view[0,1]=[${view[0]}, ${view[1]}]\n` +
          `ab.transfer() → 返回新 ArrayBuffer，原 ab detached = ${afterDetached}，byteLength = ${afterByteLength}\n` +
          `新 transferred: byteLength = ${transferred.byteLength}，新视图 [0,1] = [${newView[0]}, ${newView[1]}]（数据保留）\n` +
          `transferToFixedLength() → 新 AB resizable = ${tflResizable}（固定长度）\n` +
          `说明：transfer 零拷贝转移所有权，转移后原 buffer detached 无法再访问；transferToFixedLength 转移为固定长度。`,
      });
      this._addLog('resizable', `transfer 后：原 detached=${afterDetached}，新 byteLength=${transferred.byteLength}，view=[${newView[0]}, ${newView[1]}]`);
    } catch (err) {
      this._addLog('warn', `transfer 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. ArrayBuffer 可调整大小（ES2024）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.resizable ? 'success' : 'error' }, caps.resizable ? 'resizable ✓' : '不可用'),
        h(Tag, { color: caps.transfer ? 'success' : 'warning' }, caps.transfer ? 'transfer ✓' : 'transfer ✗'),
        h(Tag, { color: 'primary' }, 'grow/resize/transfer/detached'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ES2024 起 new ArrayBuffer(byteLength, { maxByteLength }) 创建可调整大小的缓冲区；ab.resizable（只读布尔）判断是否可调整；ab.maxByteLength（只读）最大长度；ab.grow(newLength) 只能增大；ab.resize(newLength) 可增可缩；ab.transfer() 零拷贝转移所有权（原 buffer detached）；ab.transferToFixedLength() 转移为固定长度；ab.detached（只读布尔）判断是否已分离。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建可调整 AB', { type: 'primary', size: 'sm', disabled: !caps.resizable, onClick: () => this._createResizableAB() }),
          this._btn('grow/resize', { type: 'primary', size: 'sm', disabled: !caps.resizable, onClick: () => this._growResizeAB() }),
          this._btn('transfer/detached', { type: 'primary', size: 'sm', disabled: !caps.transfer, onClick: () => this._transferAB() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '可调整 ArrayBuffer 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.resizableInfo || '（点击「创建可调整 AB」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`const ab = new ArrayBuffer(8, { maxByteLength: 32 });
ab.resizable;        // true
ab.maxByteLength;    // 32
ab.grow(16);         // 只能增大，新字节初始化为 0
ab.resize(12);       // 可增可缩
const t = ab.transfer();      // 零拷贝转移，原 ab.detached = true
ab.transferToFixedLength();   // 转移为固定长度 buffer`)),
        h(Alert, {
          type: 'info',
          message: 'transfer 是零拷贝所有权转移',
          description: 'transfer 与深拷贝不同：它把底层内存的所有权「移动」到新 ArrayBuffer，原 buffer 进入 detached 状态（byteLength 变 0，任何访问抛 TypeError）。这在跨 Worker 传递大数据时避免拷贝开销。transferToFixedLength 进一步把可调整 buffer 转为固定长度。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：WeakRef + FinalizationRegistry ===================

  // new WeakRef(target) + weakRef.deref() + new FinalizationRegistry(callback)
  _createWeakRef() {
    if (typeof WeakRef === 'undefined') {
      this._addLog('warn', 'WeakRef 不可用，需 Node 18+ 或现代浏览器');
      return;
    }
    try {
      // 创建一个临时对象并用 WeakRef 包装
      const target = { id: Date.now(), label: '弱引用目标' };
      this._weakRef = new WeakRef(target);
      // deref 取出目标（未被 GC 时返回 target）
      const deref1 = this._weakRef.deref();
      this.setState({
        weakRefInfo:
          `new WeakRef(target) → 弱引用 ✓\n` +
          `target = { id: ${target.id}, label: '${target.label}' }\n` +
          `weakRef.deref() = ${deref1 ? 'target（对象仍存活）' : 'undefined（已被 GC）'}\n` +
          `说明：WeakRef 不阻止 GC 回收 target；deref() 在 target 被 GC 后返回 undefined。\n` +
          `  典型用途：缓存（避免强引用导致内存泄漏）、可选监听器。`,
      });
      this._addLog('weakref', `WeakRef 创建：deref()=${deref1 ? '对象存活' : 'undefined'}，id=${target.id}`);
    } catch (err) {
      this._addLog('warn', `创建 WeakRef 失败：${err.name} - ${err.message}`);
    }
  }

  // new FinalizationRegistry(callback) + register + unregister
  _createFinalizationRegistry() {
    if (typeof FinalizationRegistry === 'undefined') {
      this._addLog('warn', 'FinalizationRegistry 不可用，需 Node 18+ 或现代浏览器');
      return;
    }
    try {
      // 创建注册表，回调在目标被 GC 时调用（heldValue 是注册时绑定的值）
      const registry = new FinalizationRegistry((heldValue) => {
        this._registryCallbackCount += 1;
        this._addLog('gc', `FinalizationRegistry 回调触发：heldValue = ${JSON.stringify(heldValue)}（第 ${this._registryCallbackCount} 次）`);
        // 注意：不能在回调中引用 target 本身（否则又产生强引用）
      });
      this._finalizationRegistry = registry;
      // 注册一个临时对象，heldValue 用一个描述对象，unregisterToken 用于注销
      const temp = { name: 'temp-' + Date.now() };
      const unregisterToken = { token: 'unregister-' + Date.now() };
      registry.register(temp, { name: temp.name, note: '该对象被 GC 时回调' }, unregisterToken);
      // unregister：注销注册（防止回调触发）
      registry.unregister(unregisterToken);
      this.setState({
        weakRefInfo:
          `new FinalizationRegistry(callback) → 注册表 ✓\n` +
          `register(temp, { name, note }, unregisterToken) 已注册\n` +
          `registry.unregister(unregisterToken) → 已注销注册（回调不会再触发）\n` +
          `说明：register(target, heldValue, unregisterToken) 注册 target；target 被 GC 时回调\n` +
          `  被调用，参数为 heldValue（不是 target 本身）。unregister 可提前注销。\n` +
          `  ⚠ GC 时机不确定，回调可能不触发或延迟触发，不能依赖它做关键资源清理。`,
      });
      this._addLog('gc', `FinalizationRegistry 已创建并注册 + 立即注销（演示 register/unregister 流程）`);
    } catch (err) {
      this._addLog('warn', `创建 FinalizationRegistry 失败：${err.name} - ${err.message}`);
    }
  }

  // 尝试触发 GC（手动 GC 不可控，仅记日志说明）
  _tryTriggerGC() {
    if (typeof WeakRef === 'undefined' || !this._weakRef) {
      this._addLog('warn', 'WeakRef 不可用或未创建');
      return;
    }
    try {
      const before = this._weakRef.deref();
      // 尝试分配大量临时对象施压触发 GC（Node 中可 --expose-gc 手动 gc()）
      const hadGc = typeof globalThis.gc === 'function';
      let gcLine = '';
      if (hadGc) {
        globalThis.gc();
        gcLine = 'globalThis.gc() 已调用（--expose-gc 启用）\n';
      } else {
        for (let i = 0; i < 100000; i++) { const _ = { x: i, y: i * 2, arr: new Array(10).fill(i) }; }
        gcLine = 'globalThis.gc 不可用，已分配 10 万临时对象施压，GC 时机由引擎决定\n';
      }
      const after = this._weakRef.deref();
      this.setState({
        weakRefInfo:
          `尝试触发 GC 并观察 WeakRef.deref()：\n` +
          `触发前 deref() = ${before ? '对象存活' : 'undefined（已被 GC）'}\n` +
          gcLine +
          `触发后 deref() = ${after ? '对象存活（GC 未回收或未触发）' : 'undefined（已被 GC）'}\n` +
          `FinalizationRegistry 回调累计触发：${this._registryCallbackCount} 次\n` +
          `说明：GC 时机由引擎决定，无法强制；回调可能不触发或延迟，不能依赖它做关键资源清理。`,
      });
      this._addLog('gc', `尝试 GC：deref 前=${before ? '存活' : 'undefined'}，后=${after ? '存活' : 'undefined'}，回调次数=${this._registryCallbackCount}`);
    } catch (err) {
      this._addLog('warn', `触发 GC 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. WeakRef + FinalizationRegistry',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.weakRef ? 'success' : 'error' }, caps.weakRef ? 'WeakRef ✓' : '不可用'),
        h(Tag, { color: caps.finalization ? 'success' : 'error' }, caps.finalization ? 'FinalizationRegistry ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '弱引用 / GC 回调'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new WeakRef(target) 创建弱引用，不阻止 GC 回收 target；weakRef.deref() 返回 target（未 GC）或 undefined（已 GC）。new FinalizationRegistry(callback) 注册对象被 GC 回收时的回调；registry.register(target, heldValue, unregisterToken) 注册；registry.unregister(unregisterToken) 注销。注意：GC 时机不确定，回调可能不触发或延迟，不能依赖它做关键资源清理。典型用途：缓存、可选监听器、资源清理辅助。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 WeakRef', { type: 'primary', size: 'sm', disabled: !caps.weakRef, onClick: () => this._createWeakRef() }),
          this._btn('FinalizationRegistry', { type: 'primary', size: 'sm', disabled: !caps.finalization, onClick: () => this._createFinalizationRegistry() }),
          this._btn('尝试触发 GC', { size: 'sm', disabled: !caps.weakRef, onClick: () => this._tryTriggerGC() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'WeakRef / FinalizationRegistry 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.weakRefInfo || '（点击「创建 WeakRef」开始）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`// WeakRef：弱引用对象
let obj = { data: 42 };
const ref = new WeakRef(obj);
ref.deref();   // { data: 42 } 或 undefined（被 GC 后）

// FinalizationRegistry：GC 回调
const registry = new FinalizationRegistry((held) => {
  console.log('对象被回收', held);
});
const token = { id: 1 };
registry.register(obj, { note: 'obj 回收时通知' }, token);
registry.unregister(token);  // 提前注销
obj = null;                  // 解除强引用，等待 GC
// 注意：GC 时机不确定，回调可能不触发！`)),
        h(Alert, {
          type: 'warning',
          message: '不能依赖 FinalizationRegistry 做关键资源清理',
          description: 'GC 时机由引擎决定，回调可能延迟甚至不触发（如页面关闭时未及回收）。因此 FinalizationRegistry 只能作为辅助手段，不能用于关闭文件句柄、释放锁等关键清理。关键资源必须用显式的 try/finally 或显式 dispose 调用保证释放。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：可转移对象（Transferable Objects）===================

  // 创建 ArrayBuffer + structuredClone + transfer，检测原 buffer detached
  _demoTransfer() {
    if (typeof structuredClone !== 'function') {
      this._addLog('warn', 'structuredClone 不可用，需 Node 17+ 或现代浏览器');
      return;
    }
    try {
      // 创建一个 ArrayBuffer 并写入数据
      const ab = new ArrayBuffer(8);
      const view = new Int32Array(ab);
      view[0] = 1234; view[1] = 5678;
      this._transferAb = ab;
      const beforeDetached = typeof ab.detached !== 'undefined' ? ab.detached : '（detached 不可用）';
      const beforeByteLength = ab.byteLength;
      // structuredClone(value, { transfer: [ab] }) —— 转移所有权
      const cloned = structuredClone({ data: view.slice() }, { transfer: [ab] });
      const afterDetached = typeof ab.detached !== 'undefined' ? ab.detached : '（不可用）';
      let afterByteLength;
      try { afterByteLength = ab.byteLength; }
      catch (e) { afterByteLength = `抛错：${e.name}（detached 后访问抛 TypeError）`; }
      const clonedData = cloned.data;
      this.setState({
        transferInfo:
          `structuredClone + transfer 演示：\n` +
          `原 ab: byteLength=${beforeByteLength}，detached=${beforeDetached}，view[0,1]=[${view[0]}, ${view[1]}]\n` +
          `structuredClone({ data: view.slice() }, { transfer: [ab] }) —— 转移所有权\n` +
          `转移后原 ab: detached=${afterDetached}，byteLength=${afterByteLength}\n` +
          `克隆数据 cloned.data[0,1] = [${clonedData[0]}, ${clonedData[1]}]（数据完整保留）\n` +
          `说明：transfer 数组中的对象零拷贝移动到克隆结果，原对象 detached 无法再访问；\n` +
          `  与深拷贝区别：深拷贝复制全部数据，转移是移动所有权，避免大对象拷贝开销。`,
      });
      this._addLog('transfer', `structuredClone+transfer：原 detached=${afterDetached}，克隆数据=[${clonedData[0]}, ${clonedData[1]}]`);
    } catch (err) {
      this._addLog('warn', `transfer 演示失败：${err.name} - ${err.message}`);
    }
  }

  // 演示 postMessage 的 transfer 概念（不实际开 Worker，仅说明可转移对象类型）
  _listTransferable() {
    try {
      // 列举常见的可转移对象类型并检测可用性
      const types = [
        ['ArrayBuffer', typeof ArrayBuffer !== 'undefined'],
        ['MessagePort', typeof MessagePort !== 'undefined'],
        ['ImageBitmap', typeof ImageBitmap !== 'undefined'],
        ['OffscreenCanvas', typeof OffscreenCanvas !== 'undefined'],
        ['ReadableStream', typeof ReadableStream !== 'undefined'],
        ['WritableStream', typeof WritableStream !== 'undefined'],
        ['TransformStream', typeof TransformStream !== 'undefined'],
        ['AudioData', typeof AudioData !== 'undefined'],     // WebCodecs
        ['VideoFrame', typeof VideoFrame !== 'undefined'],   // WebCodecs
      ];
      const lines = types.map(([name, avail]) => `• ${name}: ${avail ? '可用' : '不可用'}`);
      // 用 ArrayBuffer 演示 detached 现象
      let detachLine = '';
      if (typeof ArrayBuffer.prototype.transfer === 'function') {
        const ab = new ArrayBuffer(4);
        new Int32Array(ab)[0] = 42;
        const t = ab.transfer();
        detachLine = `\n\nArrayBuffer.transfer() 演示：\n  原 ab.detached = ${ab.detached}（分离）\n  新 ab byteLength = ${t.byteLength}，Int32[0] = ${new Int32Array(t)[0]}（数据保留）`;
      }
      this.setState({
        transferInfo:
          `可转移对象（Transferable Objects）类型检测：\n${lines.join('\n')}\n\n` +
          `postMessage(message, transfer) 的 transfer 数组接受上述类型。转移后原对象 detached，无法再访问；\n` +
          `与深拷贝区别：拷贝复制数据，转移移动所有权（零拷贝）。${detachLine}\n\n` +
          `说明：Worker 间传递大数据用 transfer 避免拷贝开销；SharedArrayBuffer 是「共享」而非「转移」。`,
      });
      this._addLog('transfer', `可转移对象检测：${types.filter((t) => t[1]).map((t) => t[0]).join('，') || '均不可用'}`);
    } catch (err) {
      this._addLog('warn', `检测失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 可转移对象（Transferable Objects）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.structuredClone ? 'success' : 'error' }, caps.structuredClone ? 'structuredClone ✓' : '不可用'),
        h(Tag, { color: caps.transfer ? 'success' : 'warning' }, caps.transfer ? 'transfer ✓' : 'transfer ✗'),
        h(Tag, { color: 'primary' }, '零拷贝所有权移动'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'postMessage(message, transfer) 的 transfer 数组接受可转移对象（ArrayBuffer / MessagePort / ImageBitmap / OffscreenCanvas / ReadableStream / WritableStream / TransformStream / AudioData / VideoFrame）；structuredClone(value, { transfer: [ab] }) 同样支持转移。转移后原对象 detached 无法再访问；与深拷贝区别：拷贝复制数据，转移零拷贝移动所有权。Worker 间传递大数据用 transfer 避免拷贝开销；SharedArrayBuffer 是共享不转移。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('structuredClone+transfer', { type: 'primary', size: 'sm', disabled: !caps.structuredClone, onClick: () => this._demoTransfer() }),
          this._btn('可转移类型检测', { size: 'sm', onClick: () => this._listTransferable() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '可转移对象演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.transferInfo || '（点击「structuredClone+transfer」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`// postMessage 转移（Worker 间）
const ab = new ArrayBuffer(1024 * 1024);   // 1MB
worker.postMessage({ data: ab }, [ab]);    // 转移，原 ab detached

// structuredClone 转移
const cloned = structuredClone({ buf }, { transfer: [buf] });
// 原 buf detached，cloned.buf 是新 ArrayBuffer

// 拷贝（不转移）
const copied = structuredClone({ buf });   // 原 buf 仍可用

// SharedArrayBuffer 共享不转移
const sab = new SharedArrayBuffer(16);
worker.postMessage(sab, [sab]);  // 不会让原 sab detached`)),
        h(Alert, {
          type: 'info',
          message: '转移是零拷贝所有权移动',
          description: '转移把底层内存的所有权交给接收方，原对象进入 detached 状态。这对 Worker 间传递大 ArrayBuffer / ImageBitmap 等避免拷贝开销至关重要。注意 SharedArrayBuffer 走 postMessage 是「共享」语义（双方都可见同一块内存），不会让原对象 detached。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 9：Shared Structs 跨 Worker 共享对象 ===================

  _runSharedStructsDemo() {
    const caps = this._caps();
    const lines = [];
    lines.push('===== Shared Structs 跨 Worker 共享对象 =====');
    lines.push('');
    lines.push('【标准】TC39 Stage 3 提案（2024-2025）');
    lines.push('  - 跨 Worker 共享的可变结构体（对象级共享）');
    lines.push('  - 不同于 SharedArrayBuffer 的字节级共享，是结构化对象共享');
    lines.push('');
    lines.push('【核心 API】');
    lines.push('  new SharedStruct()              创建共享结构体');
    lines.push('  struct.field = value            字段读写（Worker 间立即可见）');
    lines.push('  SharedArray / SharedMap          共享数组与映射');
    lines.push('');
    lines.push('【与 SharedArrayBuffer 对比】');
    lines.push('  SharedArrayBuffer：字节级共享，需 Atomics 同步，手写视图');
    lines.push('  SharedStruct：对象级共享，字段直接读写，引擎管理同步');
    lines.push('  // SAB 更底层、更灵活；SharedStruct 更易用、更结构化');
    lines.push('');
    lines.push('【与 SharedArray/SharedMap/SharedArrayBuffer 协同】');
    lines.push('  const s = new SharedStruct();');
    lines.push('  s.count = 0;');
    lines.push('  const arr = new SharedArray(10);');
    lines.push('  const map = new SharedMap();');
    lines.push('  // 传递给 Worker，双方引用同一对象');
    lines.push('  worker.postMessage(s, [s]);  // 转移共享引用');
    lines.push('');
    lines.push('【实战：Worker 间共享状态】');
    lines.push('  // 主线程');
    lines.push('  const state = new SharedStruct();');
    lines.push('  state.counter = 0;');
    lines.push('  state.running = true;');
    lines.push('  const w1 = new Worker("w.js");');
    lines.push('  const w2 = new Worker("w.js");');
    lines.push('  w1.postMessage(state, [state]);  // w1 持有共享引用');
    lines.push('  w2.postMessage(state, [state]);  // w2 也持有');
    lines.push('  // Worker 内修改 state.counter，主线程立即可见，无需序列化');
    lines.push('');
    lines.push('  // Worker 内（w.js）');
    lines.push('  self.onmessage = (e) => {');
    lines.push('    const state = e.data;');
    lines.push('    state.counter++;  // 直接修改共享结构体');
    lines.push('  };');
    lines.push('');
    lines.push('【降级策略】');
    lines.push('  - 不支持 SharedStruct：用 SharedArrayBuffer + Atomics 模拟');
    lines.push('  - 或用 postMessage 序列化复制（无共享，有拷贝开销）');
    lines.push('  - 或用 BroadcastChannel 同步状态变更消息');
    lines.push('');
    lines.push('【当前环境能力检测】');
    lines.push('  SharedStruct: ' + (caps.sharedStruct ? '✓' : '✗'));
    lines.push('');
    lines.push('【浏览器支持】');
    lines.push('  Chrome        behind flag（实验性）');
    lines.push('  Firefox       未实现');
    lines.push('  Safari        未实现');
    lines.push('  Node/jsdom    ✗（提案尚未进入运行时）');

    this.setState({ sharedStructsInfo: lines.join('\n') });

    if (!caps.sharedStruct) {
      this._addLog('warn', 'SharedStruct 不可用（TC39 Stage 3，Chrome behind flag），仅展示文档与代码');
    } else {
      this._addLog('info', 'SharedStruct 可用，可体验跨 Worker 对象共享');
    }
  }

  _renderCard9() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '9. Shared Structs —— 跨 Worker 共享对象',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.sharedStruct ? 'success' : 'error' }, caps.sharedStruct ? 'SharedStruct ✓' : 'SharedStruct ✗'),
        h(Tag, { color: 'primary' }, 'TC39 Stage 3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Shared Structs（TC39 Stage 3 提案）提供跨 Worker 共享的可变结构体，是对象级共享（new SharedStruct() / SharedArray / SharedMap），不同于 SharedArrayBuffer 的字节级共享。字段直接读写，引擎管理同步，Worker 间修改立即可见无需序列化。与 SharedArrayBuffer 对比：SAB 更底层需 Atomics，SharedStruct 更易用更结构化。Chrome behind flag 实验，Firefox/Safari 未实现。降级用 SharedArrayBuffer+Atomics 或 postMessage 拷贝。jsdom 无，演示仅展示文档。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 Shared Structs 文档与代码', { type: 'primary', size: 'sm', onClick: () => this._runSharedStructsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Shared Structs 文档与示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '520px', overflow: 'auto' } },
          h('code', {}, s.sharedStructsInfo || '（点击按钮查看 Shared Structs 完整文档与 Worker 共享状态示例）')),
        h(Alert, {
          type: 'info',
          message: 'Shared Structs 实现对象级跨 Worker 共享',
          description: '与 SharedArrayBuffer 字节级共享互补：SharedStruct 字段直接读写，引擎管理同步，更易用。TC39 Stage 3，Chrome behind flag。jsdom 无，演示仅展示文档。降级用 SAB+Atomics 或 postMessage 拷贝。',
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
      h('h2', { class: 'section-title' }, '共享内存与原子操作实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'SharedArrayBuffer 提供跨 Worker 共享的固定长度内存；Atomics 提供原子操作与 wait/notify 同步原语；ES2024 ArrayBuffer 支持 resizable/transfer；WeakRef + FinalizationRegistry 提供弱引用与 GC 回调；可转移对象实现零拷贝所有权移动。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderCard9(),
      this._renderLogPanel(),
    );
  }
}
