// =====================================================================
// ConcurrencyPage.js —— 并发与通信 API 实验室
// 演示 MDN：
//   1. SharedWorker —— new SharedWorker(url, name)、port.start/postMessage/onmessage、
//      多标签页共享；用 Blob URL 内联 worker 脚本。
//   2. MessageChannel / MessagePort —— new MessageChannel()、port1/port2、
//      postMessage/onmessage/start/close、Transferable（port2 transfer 给 worker）。
//   3. SharedArrayBuffer + Atomics —— new SharedArrayBuffer(byteLength)、
//      Atomics.load/store/add/sub/and/or/xor、Atomics.wait/notify/waitAsync、
//      Transferable、crossOriginIsolated / COOP/COEP 要求。
//   4. Scheduler API —— scheduler.postTask、priority: 'user-blocking'|'user-visible'|'background'、
//      TaskSignal / TaskController（AbortController 子类）、scheduler.yield()。
//   5. Compute Pressure API + FinalizationRegistry/WeakRef ——
//      PressureObserver(observe 'cpu')、PressureRecord.source/state/time、
//      state: 'nominal'|'fair'|'serious'|'critical'、FinalizationRegistry/WeakRef.deref()。
// 说明：所有调用前做 typeof / in 能力检测，不可用时记日志说明；worker 全部用 Blob URL 内联。
// =====================================================================
import { Page } from '../../core/Component.js';

declare const Buffer: any;
import { h, formatTime, errInfo } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';
import type { ButtonProps } from '../../components/ui/Button.js';

interface LogEntry { type: string; content: string; time: string; }

export interface ConcurrencyPageProps extends Props {}

export interface ConcurrencyPageState extends State {
  logs: LogEntry[];
  sharedSupported: boolean;
  sharedClients: number;
  sabSupported: boolean;
  crossOriginIsolated: boolean;
  schedulerSupported: boolean;
  pressureSupported: boolean;
  pressureState: string;
  pressureCount: number;
  taskOrder: any[];
  finalizationTriggered: boolean;
  weakRefAlive: string | null;
}

export class ConcurrencyPage extends Page {
  declare props: ConcurrencyPageProps;
  declare state: ConcurrencyPageState;

  _inited: boolean = false;
  declare _destroyed: boolean;
  _sharedWorker!: any;
  _sharedPorts!: any[];
  _sharedBlobUrl!: any;
  _channel!: any;
  _channelWorker!: any;
  _channelBlobUrl!: any;
  _sabWorker!: any;
  _sabBlobUrl!: any;
  _taskControllers!: any[];
  _pressureObserver!: any;
  _finalizationRegistry!: any;


  initialState(): ConcurrencyPageState {
    const coi = typeof self !== 'undefined' && !!self.crossOriginIsolated;
    return {
      logs: [],
      sharedSupported: typeof SharedWorker !== 'undefined',
      sharedClients: 0,
      sabSupported: typeof SharedArrayBuffer !== 'undefined' && coi,
      crossOriginIsolated: coi,
      schedulerSupported:
        (typeof globalThis !== 'undefined' && 'scheduler' in globalThis) ||
        (typeof window !== 'undefined' && 'scheduler' in window),
      pressureSupported: typeof PressureObserver !== 'undefined',
      pressureState: '—',
      pressureCount: 0,
      taskOrder: [],
      finalizationTriggered: false,
      weakRefAlive: null,
    };
  }

  componentDidMount(): void {
    // ★ 关键守卫：避免 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    this._sharedWorker = null; this._sharedPorts = []; this._sharedBlobUrl = null;
    this._channel = null; this._channelWorker = null; this._channelBlobUrl = null;
    this._sabWorker = null; this._sabBlobUrl = null;
    this._taskControllers = []; this._pressureObserver = null; this._finalizationRegistry = null;

    const s = this.state;
    this._addLog('info', '页面已就绪，能力检测：' +
      `SharedWorker=${s.sharedSupported ? '✓' : '✗'}，` +
      `crossOriginIsolated=${s.crossOriginIsolated ? '✓' : '✗'}，` +
      `SAB=${s.sabSupported ? '✓' : '✗'}，` +
      `Scheduler=${s.schedulerSupported ? '✓' : '✗'}，` +
      `Pressure=${s.pressureSupported ? '✓' : '✗'}`);
    if (!s.sabSupported) this._addLog('warn', 'SharedArrayBuffer 不可用：需 crossOriginIsolated=true（COOP/COEP）');
    if (!s.schedulerSupported) this._addLog('warn', 'Scheduler API 不可用：将回退到 setTimeout/queueMicrotask');
    if (!s.pressureSupported) this._addLog('warn', 'PressureObserver 不可用：需较新 Chromium 内核');
  }

  componentWillUnmount(): void {
    // 终止 SharedWorker
    try {
      this._sharedPorts.forEach((p) => { try { p.close(); } catch { /* noop */ } });
      this._sharedPorts = [];
      if (this._sharedBlobUrl) { URL.revokeObjectURL(this._sharedBlobUrl); this._sharedBlobUrl = null; }
    } catch { /* noop */ }
    // 关闭 MessageChannel 与对应 worker
    try {
      if (this._channel) {
        try { this._channel.port1.close(); } catch { /* noop */ }
        try { this._channel.port2.close(); } catch { /* noop */ }
        this._channel = null;
      }
      if (this._channelWorker) { this._channelWorker.terminate(); this._channelWorker = null; }
      if (this._channelBlobUrl) { URL.revokeObjectURL(this._channelBlobUrl); this._channelBlobUrl = null; }
    } catch { /* noop */ }
    // 终止 SAB 演示 worker
    try {
      if (this._sabWorker) { this._sabWorker.terminate(); this._sabWorker = null; }
      if (this._sabBlobUrl) { URL.revokeObjectURL(this._sabBlobUrl); this._sabBlobUrl = null; }
    } catch { /* noop */ }
    // 取消尚未执行的 scheduler 任务
    try {
      this._taskControllers.forEach((c) => { try { c.abort(); } catch { /* noop */ } });
      this._taskControllers = [];
    } catch { /* noop */ }
    // 断开 PressureObserver
    try {
      if (this._pressureObserver) {
        try { this._pressureObserver.disconnect(); } catch { /* noop */ }
        this._pressureObserver = null;
      }
    } catch { /* noop */ }
  }

  _addLog(type: string, content: string): void {
    this.setState({ logs: [...(this.state.logs || []), { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: ButtonProps): Node | string {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  _renderLogPanel(): Node | string {
    const s = this.state;
    const logs = s.logs || [];
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志（共享给所有卡片）'),
      logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== Card 1：SharedWorker ===================

  _initSharedWorker(): void {
    if (!this.state.sharedSupported) {
      this._addLog('err', 'SharedWorker 不可用（部分浏览器/隐私模式禁用）');
      return;
    }
    if (this._sharedWorker) {
      this._addLog('info', 'SharedWorker 已连接，直接复用当前端口');
      return;
    }
    // 内联 SharedWorker 脚本：维护连接列表，广播消息给所有端口
    const workerCode = `
      const ports = new Set<any>(); let seq = 0;
      self.onconnect = (e) => {
        const port = e.ports[0]; const id = ++seq;
        ports.add(port); port.start();
        port.postMessage({ kind: 'welcome', id, total: ports.size });
        port.onmessage = (ev) => {
          const text = (ev.data || {}).text || '';
          for (const p of ports) if (p !== port) {
            try { p.postMessage({ kind: 'broadcast', from: id, text }); } catch (_: any) {}
          }
          port.postMessage({ kind: 'echo', from: id, text });
        };
        port.onmessageerror = () => ports.delete(port);
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    this._sharedBlobUrl = url;
    try {
      const sw = new SharedWorker(url, 'concurrency-lab-shared');
      this._sharedWorker = sw;
      const port = sw.port;
      port.start();
      this._sharedPorts.push(port);
      port.onmessage = (e) => {
        const d = e.data || {};
        if (d.kind === 'welcome') {
          this._addLog('push', `SharedWorker 已连接 → 端口#${d.id}，当前连接数 ${d.total}`);
          this.setState({ sharedClients: d.total });
        } else if (d.kind === 'echo') {
          this._addLog('info', `本地回执（端口#${d.from}）: ${d.text}`);
        } else if (d.kind === 'broadcast') {
          this._addLog('pull', `收到广播（来自端口#${d.from}）: ${d.text}`);
        }
      };
      port.onmessageerror = () => this._addLog('err', 'SharedWorker port messageerror');
      sw.onerror = (err) => this._addLog('err', `SharedWorker error: ${err.message || 'unknown'}`);
      this._addLog('push', '已创建 SharedWorker（Blob URL），等待 onconnect...');
    } catch (err: any) {
      this._addLog('err', `创建 SharedWorker 失败：${err.message}`);
      URL.revokeObjectURL(url);
      this._sharedBlobUrl = null;
    }
  }

  _sendSharedWorkerMessage(): void {
    if (!this._sharedWorker) {
      this._addLog('warn', '请先点击「连接 SharedWorker」');
      return;
    }
    const text = `hello @ ${formatTime()}`;
    try {
      this._sharedPorts[0].postMessage({ text });
      this._addLog('push', `已发送: ${text}`);
    } catch (err: any) {
      this._addLog('err', `postMessage 失败：${err.message}`);
    }
  }

  _closeSharedWorker(): void {
    try {
      this._sharedPorts.forEach((p) => { try { p.close(); } catch { /* noop */ } });
      this._sharedPorts = [];
      if (this._sharedBlobUrl) { URL.revokeObjectURL(this._sharedBlobUrl); this._sharedBlobUrl = null; }
      this._sharedWorker = null;
      this._addLog('info', '已关闭 SharedWorker 端口并释放 Blob URL');
    } catch (err: any) {
      this._addLog('err', `关闭失败：${err.message}`);
    }
  }

  _renderSharedWorkerCard() {
    const s = this.state;
    return h(Card, {
      title: 'Card 1 · SharedWorker',
      extra: h(Tag, { color: s.sharedSupported ? 'success' : 'error' },
        s.sharedSupported ? '稳定' : '不可用'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '多个标签页可共享同一个 worker（同源 + 同名）。' +
        '通过 port.postMessage / port.onmessage 双向通信；' +
        'worker 内 onconnect 拿到 port 并广播给所有连接。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('连接 SharedWorker', {
          type: 'primary', size: 'sm',
          onClick: () => this._initSharedWorker(),
        }),
        this._btn('发送一条消息', {
          size: 'sm',
          onClick: () => this._sendSharedWorkerMessage(),
        }),
        this._btn('断开', {
          size: 'sm', danger: true,
          onClick: () => this._closeSharedWorker(),
        }),
        h(Tag, { color: 'primary' }, `当前连接数：${s.sharedClients}`),
      ),
      h('pre', { class: 'code-block mt-md' },
`const sw = new SharedWorker(url, 'name');
sw.port.start();
sw.port.postMessage({ text: 'hi' });
sw.port.onmessage = (e) => console.log(e.data);

// worker 内：维护连接列表并广播
self.onconnect = (e) => { e.ports[0].start(); /* ... */ };`),
    );
  }

  // =================== Card 2：MessageChannel / MessagePort ===================

  _setupMessageChannel(): void {
    if (this._channel) {
      this._addLog('info', 'MessageChannel 已存在，可直接发送');
      return;
    }
    try {
      const channel = new MessageChannel();
      this._channel = channel;
      // port1 留在主线程，监听 worker 通过 port2 回复的消息
      channel.port1.start();
      channel.port1.onmessage = (e) => {
        this._addLog('pull', `port1 收到回复: ${JSON.stringify(e.data)}`);
      };
      channel.port1.onmessageerror = () => this._addLog('err', 'port1 messageerror');

      // 内联 worker：接收 transfer 过来的 port2，并通过它回复
      const workerCode = `
        let remotePort = null;
        self.onmessage = (e) => {
          if ((e.data || {}).kind === 'transfer-port') {
            remotePort = e.ports[0]; remotePort.start();
            remotePort.onmessage = (ev) =>
              remotePort.postMessage({ echo: ev.data && ev.data.text, at: Date.now() });
            remotePort.postMessage({ kind: 'ready' });
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      this._channelBlobUrl = url;
      const worker = new Worker(url);
      this._channelWorker = worker;
      worker.onmessage = (e) => {
        // worker 自身 self.postMessage（非 port）会到这
        this._addLog('info', `worker 主通道: ${JSON.stringify(e.data)}`);
      };
      worker.onerror = (err) => this._addLog('err', `Worker error: ${err.message || ''}`);
      // 把 port2 transfer 给 worker
      worker.postMessage({ kind: 'transfer-port' }, [channel.port2]);
      this._addLog('push', '已创建 MessageChannel 并把 port2 transfer 给 Worker');
    } catch (err: any) {
      this._addLog('err', `创建 MessageChannel 失败：${err.message}`);
    }
  }

  _sendViaChannel(): void {
    if (!this._channel) {
      this._addLog('warn', '请先点击「建立 MessageChannel」');
      return;
    }
    const text = `ping-${Math.floor(Math.random() * 1000)}`;
    try {
      this._channel.port1.postMessage({ text });
      this._addLog('push', `port1 → port2: ${text}`);
    } catch (err: any) {
      this._addLog('err', `postMessage 失败：${err.message}`);
    }
  }

  _closeChannel(): void {
    try {
      if (this._channel) {
        try { this._channel.port1.close(); } catch { /* noop */ }
        try { this._channel.port2.close(); } catch { /* noop */ }
        this._channel = null;
      }
      if (this._channelWorker) { this._channelWorker.terminate(); this._channelWorker = null; }
      if (this._channelBlobUrl) { URL.revokeObjectURL(this._channelBlobUrl); this._channelBlobUrl = null; }
      this._addLog('info', '已关闭 MessagePort 并终止 Worker');
    } catch (err: any) {
      this._addLog('err', `关闭失败：${err.message}`);
    }
  }

  _renderMessageChannelCard() {
    return h(Card, {
      title: 'Card 2 · MessageChannel / MessagePort',
      extra: h(Tag, { color: 'success' }, '稳定'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'MessageChannel 创建一对 port1/port2，可将其中一端 transfer 给另一个上下文（如 Worker）。' +
        '两端通过 postMessage / onmessage 双向通信，调用 start() 开始派发，close() 关闭。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('建立 MessageChannel', {
          type: 'primary', size: 'sm',
          onClick: () => this._setupMessageChannel(),
        }),
        this._btn('通过 port1 发送', {
          size: 'sm',
          onClick: () => this._sendViaChannel(),
        }),
        this._btn('关闭', {
          size: 'sm', danger: true,
          onClick: () => this._closeChannel(),
        }),
      ),
      h('pre', { class: 'code-block mt-md' },
`const ch = new MessageChannel();
ch.port1.onmessage = (e) => console.log('reply', e.data);
const worker = new Worker(url);
// 把 port2 transfer 给 worker（Transferable）
worker.postMessage({ kind: 'transfer-port' }, [ch.port2]);
// worker 内：e.ports[0] 即 port2，可双向通信`),
    );
  }

  // =================== Card 3：SharedArrayBuffer + Atomics ===================

  _testAtomicsSync(): void {
    if (!this.state.sabSupported) {
      this._addLog('err', 'SharedArrayBuffer 不可用，跳过同步原语演示');
      return;
    }
    try {
      const sab = new SharedArrayBuffer(4 * 4); // 4 个 Int32
      const view = new Int32Array(sab);
      Atomics.store(view, 0, 10);
      Atomics.store(view, 1, 0);
      const before = Atomics.load(view, 0);
      const added = Atomics.add(view, 0, 5);
      const after = Atomics.load(view, 0);
      Atomics.sub(view, 0, 2);
      Atomics.and(view, 1, 0xff);
      Atomics.or(view, 2, 0b1010);
      Atomics.xor(view, 3, 0b0011);
      this._addLog('push',
        `Atomics 操作：store(0,10)→load=${before}；add(0,5)→返回旧值${added}，load=${after}；` +
        `sub(0,2)→${Atomics.load(view, 0)}；` +
        `view=[${view[0]},${view[1]},${view[2]},${view[3]}]`);
    } catch (err: any) {
      this._addLog('err', `Atomics 演示失败：${err.message}`);
    }
  }

  _testWaitNotify(): void {
    if (!this.state.sabSupported) {
      this._addLog('err', 'SharedArrayBuffer 不可用，跳过 wait/notify 演示');
      return;
    }
    if (this._sabWorker) {
      this._addLog('warn', '上一轮 worker 仍在运行，请稍后');
      return;
    }
    try {
      const sab = new SharedArrayBuffer(4);
      const view = new Int32Array(sab);
      Atomics.store(view, 0, 0);

      // 内联 worker：在 view[0] 上 Atomics.wait，被 notify 后唤醒
      const workerCode = `
        self.onmessage = (e) => {
          const view = new Int32Array(e.data.sab);
          const r = Atomics.wait(view, 0, 0, 5000);
          self.postMessage({ kind: 'woken', result: r, value: Atomics.load(view, 0) });
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      this._sabBlobUrl = url;
      const worker = new Worker(url);
      this._sabWorker = worker;
      worker.onmessage = (e) => {
        const d = e.data || {};
        if (d.kind === 'woken') {
          this._addLog('pull', `worker Atomics.wait 返回 "${d.result}"，当前值=${d.value}`);
        }
        // 清理
        try { worker.terminate(); } catch { /* noop */ }
        try { URL.revokeObjectURL(url); } catch { /* noop */ }
        this._sabWorker = null;
        this._sabBlobUrl = null;
      };
      worker.onerror = (err) => {
        this._addLog('err', `SAB worker error: ${err.message || ''}`);
        try { worker.terminate(); } catch { /* noop */ }
        this._sabWorker = null;
        this._sabBlobUrl = null;
      };
      // 把 SharedArrayBuffer transfer 给 worker
      worker.postMessage({ sab }, [sab]);
      this._addLog('push', 'worker 已进入 Atomics.wait(view,0,0,5000)，1 秒后主线程 notify');
      setTimeout(() => {
        if (!this._sabWorker) return;
        const woken = Atomics.notify(view, 0, 1);
        this._addLog('push', `主线程 Atomics.notify → 唤醒 ${woken} 个等待者`);
      }, 1000);
    } catch (err: any) {
      this._addLog('err', `wait/notify 演示失败：${err.message}`);
    }
  }

  _testWaitAsync(): void {
    if (!this.state.sabSupported) {
      this._addLog('err', 'SharedArrayBuffer 不可用，跳过 waitAsync 演示');
      return;
    }
    if (typeof Atomics.waitAsync !== 'function') {
      this._addLog('warn', 'Atomics.waitAsync 不可用（需较新 Chromium）');
      return;
    }
    try {
      const sab = new SharedArrayBuffer(4);
      const view = new Int32Array(sab);
      Atomics.store(view, 0, 0);
      const { async, value } = Atomics.waitAsync(view, 0, 0, 3000);
      this._addLog('push', `waitAsync 触发，async=${async}, value=${JSON.stringify(value)}`);
      if (async && value && typeof value.then === 'function') {
        value.then((r) => {
          this._addLog('pull', `waitAsync resolved → "${r}"`);
        }).catch((err) => {
          this._addLog('err', `waitAsync rejected: ${err.message}`);
        });
      } else {
        this._addLog('info', `waitAsync 同步返回: ${JSON.stringify(value)}`);
      }
      // 800ms 后 notify
      setTimeout(() => {
        const woken = Atomics.notify(view, 0, 1);
        this._addLog('push', `notify 唤醒 ${woken} 个 waitAsync 等待者`);
      }, 800);
    } catch (err: any) {
      this._addLog('err', `waitAsync 演示失败：${err.message}`);
    }
  }

  _renderSABCard() {
    const s = this.state;
    return h(Card, {
      title: 'Card 3 · SharedArrayBuffer + Atomics',
      extra: h(Tag, { color: s.sabSupported ? 'success' : 'error' },
        s.sabSupported ? '可用' : '不可用'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'SharedArrayBuffer 在多线程间共享同一段内存；Atomics 提供原子操作与 wait/notify 同步原语。' +
        '主线程不能用 Atomics.wait（会阻塞 UI），但可用 waitAsync；worker 内可用 wait。'),
      h(Alert, {
        type: s.sabSupported ? 'success' : 'warning',
        message: `crossOriginIsolated = ${s.crossOriginIsolated}`,
        description: s.sabSupported
          ? '页面具备 COOP: same-origin 与 COEP: require-corp，可安全使用 SharedArrayBuffer。'
          : '需服务端响应 Cross-Origin-Opener-Policy: same-origin 与 Cross-Origin-Embedder-Policy: require-corp 才能启用。',
      }),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('store/load/add/sub/and/or/xor', {
          type: 'primary', size: 'sm',
          onClick: () => this._testAtomicsSync(),
          disabled: !s.sabSupported,
        }),
        this._btn('wait / notify（worker）', {
          size: 'sm',
          onClick: () => this._testWaitNotify(),
          disabled: !s.sabSupported,
        }),
        this._btn('waitAsync（主线程）', {
          size: 'sm',
          onClick: () => this._testWaitAsync(),
          disabled: !s.sabSupported,
        }),
      ),
      h('pre', { class: 'code-block mt-md' },
`const sab = new SharedArrayBuffer(4);
const view = new Int32Array(sab);
Atomics.store(view, 0, 10); Atomics.add(view, 0, 5);
// worker 内阻塞：Atomics.wait(view, 0, 0, 5000);
// 主线程唤醒：Atomics.notify(view, 0, 1);
// 主线程非阻塞：Atomics.waitAsync(view, 0, 0, 3000).value.then(...);`),
    );
  }

  // =================== Card 4：Scheduler API ===================

  _runSchedulerPriorities(): void {
    this.setState({ taskOrder: [] });
    const record = (label: any) => {
      this.setState((s) => ({ ...s, taskOrder: [...(s.taskOrder || []), label].slice(-12) }));
      this._addLog('push', `执行: ${label}`);
    };

    if (this.state.schedulerSupported && typeof globalThis.scheduler?.postTask === 'function') {
      this._addLog('info', 'scheduler.postTask 调度：user-blocking → user-visible → background');
      // 按倒序提交，看优先级如何影响执行顺序
      globalThis.scheduler.postTask(() => record('background'), { priority: 'background' });
      globalThis.scheduler.postTask(() => record('user-visible'), { priority: 'user-visible' });
      globalThis.scheduler.postTask(() => record('user-blocking'), { priority: 'user-blocking' });
    } else {
      this._addLog('warn', 'Scheduler 不可用，回退到 setTimeout(0)/queueMicrotask 模拟');
      // 回退：user-blocking → microtask，user-visible → setTimeout(0)，background → setTimeout(10)
      queueMicrotask(() => record('user-blocking (microtask)'));
      setTimeout(() => record('user-visible (setTimeout 0)'), 0);
      setTimeout(() => record('background (setTimeout 10)'), 10);
    }
  }

  _runSchedulerAbort(): void {
    if (this.state.schedulerSupported && typeof globalThis.scheduler?.postTask === 'function' && typeof TaskController !== 'undefined') {
      const controller = new TaskController({ priority: 'user-visible' });
      this._taskControllers.push(controller);
      const id = this._taskControllers.length;
      globalThis.scheduler.postTask(
        () => this._addLog('info', `任务#${id} 执行了（不应出现，因为会被取消）`),
        { signal: controller.signal },
      ).catch((err) => {
        const info = errInfo(err);
        this._addLog('pull', `任务#${id} 被取消：${info.name || 'AbortError'}`);
      });
      // 立即取消
      setTimeout(() => {
        try { controller.abort(); } catch (e: any) { this._addLog('err', `abort 失败: ${e.message}`); }
      }, 0);
      this._addLog('push', `已用 TaskController 提交任务#${id} 并立即 abort()`);
    } else {
      // 回退：用 AbortController + setTimeout 模拟
      const controller = new AbortController();
      const id = this._taskControllers.length + 1;
      this._taskControllers.push(controller);
      const t = setTimeout(() => {
        if (!controller.signal.aborted) {
          this._addLog('info', `任务#${id} 执行了（不应出现）`);
        }
      }, 50);
      controller.signal.addEventListener('abort', () => {
        clearTimeout(t);
        this._addLog('pull', `任务#${id} 被 AbortController 取消（回退模式）`);
      });
      setTimeout(() => { try { controller.abort(); } catch { /* noop */ } }, 0);
      this._addLog('push', `回退：用 AbortController + setTimeout 提交任务#${id} 并 abort`);
    }
  }

  async _runSchedulerYield() {
    this._addLog('info', '开始 scheduler.yield() 演示（让出主线程）');
    const chunks = ['A', 'B', 'C'];
    for (const c of chunks) {
      this._addLog('push', `处理块 ${c}`);
      // 让出主线程：scheduler.yield 或回退到 setTimeout(0)
      if (this.state.schedulerSupported && typeof globalThis.scheduler?.yield === 'function') {
        await globalThis.scheduler.yield();
      } else {
        await new Promise((r) => setTimeout(r, 0));
      }
      this._addLog('pull', `块 ${c} 已恢复（主线程已让出过）`);
    }
    this._addLog('info', 'scheduler.yield() 演示完成');
  }

  _renderSchedulerCard() {
    const s = this.state;
    return h(Card, {
      title: 'Card 4 · Scheduler API + Prioritized Task Scheduling',
      extra: h(Tag, { color: s.schedulerSupported ? 'primary' : 'warning' },
        s.schedulerSupported ? '实验性' : '回退'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'scheduler.postTask(cb, {priority, signal, delay}) 按优先级调度任务；' +
        'TaskController（AbortController 子类）可中途取消；scheduler.yield() 让出主线程。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('提交 3 个不同优先级', {
          type: 'primary', size: 'sm',
          onClick: () => this._runSchedulerPriorities(),
        }),
        this._btn('TaskController 取消任务', {
          size: 'sm',
          onClick: () => this._runSchedulerAbort(),
        }),
        this._btn('scheduler.yield() 让出', {
          size: 'sm',
          onClick: () => this._runSchedulerYield(),
        }),
      ),
      s.taskOrder.length > 0
        ? h('div', { class: 'mt-md fs-sm' },
            '执行顺序：',
            s.taskOrder.map((t, i) => h(Tag, { key: i, color: 'primary' }, `${i + 1}.${t}`)),
          )
        : null,
      h('pre', { class: 'code-block mt-md' },
`// 优先级：'user-blocking' > 'user-visible' > 'background'
scheduler.postTask(fn, { priority: 'background' });
const c = new TaskController({ priority: 'user-visible' });
scheduler.postTask(fn, { signal: c.signal }).catch(() => {});
c.abort(); // 取消
await scheduler.yield(); // 让出主线程（长任务分片）`),
    );
  }

  // =================== Card 5：Compute Pressure + FinalizationRegistry/WeakRef ===================

  _initPressureObserver(): void {
    if (!this.state.pressureSupported) {
      this._addLog('err', 'PressureObserver 不可用');
      return;
    }
    if (this._pressureObserver) {
      this._addLog('info', 'PressureObserver 已在运行');
      return;
    }
    try {
      const observer = new PressureObserver((records: any) => {
        for (const r of records) {
          const state = r.state;
          const src = r.source;
          const t = r.time;
          this._addLog('pull', `Pressure → source=${src}, state=${state}, time=${(t as any).toFixed(0)}`);
          this.setState((s) => ({
            ...s,
            pressureState: state,
            pressureCount: (s.pressureCount || 0) + 1,
          }));
        }
      });
      observer.observe('cpu').then(() => {
        this._addLog('push', 'PressureObserver 已 observe("cpu")，等待状态变化...');
      }).catch((err) => {
        this._addLog('err', `observe("cpu") 失败：${err.message}`);
      });
      this._pressureObserver = observer;
    } catch (err: any) {
      this._addLog('err', `创建 PressureObserver 失败：${err.message}`);
    }
  }

  _stopPressureObserver(): void {
    if (!this._pressureObserver) {
      this._addLog('info', 'PressureObserver 未启动');
      return;
    }
    try {
      this._pressureObserver.disconnect();
      this._pressureObserver = null;
      this._addLog('info', 'PressureObserver 已 disconnect');
    } catch (err: any) {
      this._addLog('err', `disconnect 失败：${err.message}`);
    }
  }

  _testFinalizationRegistry(): void {
    if (typeof FinalizationRegistry !== 'function') {
      this._addLog('err', 'FinalizationRegistry 不可用');
      return;
    }
    if (!this._finalizationRegistry) {
      this._finalizationRegistry = new FinalizationRegistry((heldValue) => {
        this.setState({ finalizationTriggered: true });
        this._addLog('pull', `FinalizationRegistry 回调触发！heldValue=${heldValue}`);
      });
    }
    this.setState({ finalizationTriggered: false });
    // 创建对象并注册，丢弃引用
    {
      const obj = { name: 'ephemeral-' + Math.floor(Math.random() * 1000) };
      this._finalizationRegistry.register(obj, obj.name);
      this._addLog('push', `已注册对象到 FinalizationRegistry：${obj.name}`);
    }
    // 尝试通过大量分配触发 GC（可能不工作，取决于引擎）
    this._addLog('info', '尝试通过大量分配触发 GC（不保证一定回收）...');
    try {
      const junk = [];
      for (let i = 0; i < 20; i++) {
        junk.push(new Array(100000).fill(Math.random()));
      }
      junk.length = 0;
    } catch (err: any) {
      this._addLog('warn', `分配压力测试异常：${err.message}`);
    }
    setTimeout(() => {
      if (!this.state.finalizationTriggered) {
        this._addLog('warn', '尚未触发 GC 回调（引擎可能延迟回收或未启用 FinalizationRegistry）');
      }
    }, 1500);
  }

  _testWeakRef(): void {
    if (typeof WeakRef !== 'function') {
      this._addLog('err', 'WeakRef 不可用');
      return;
    }
    let target = { id: 'weakref-' + Date.now() };
    const ref = new WeakRef(target);
    const aliveBefore = ref.deref() !== undefined;
    this._addLog('push', `创建 WeakRef，初始 deref() 返回对象：${aliveBefore}`);
    this.setState({ weakRefAlive: aliveBefore });
    // 丢弃强引用
    target = (null as any);
    // 多次微任务后检查
    const check = (round: any) => {
      if (round > 5) {
        const alive = ref.deref() !== undefined;
        this.setState({ weakRefAlive: alive });
        this._addLog(alive ? 'info' : 'pull',
          alive ? `第${round}轮 deref() 仍存活（未 GC）`
                : `第${round}轮 deref() 返回 undefined（已被 GC）`);
        return;
      }
      try {
        const junk = [];
        for (let i = 0; i < 5; i++) junk.push(new Array(50000).fill(0));
        junk.length = 0;
      } catch { /* noop */ }
      setTimeout(() => check(round + 1), 0);
    };
    check(1);
  }

  _renderPressureCard() {
    const s = this.state;
    return h(Card, {
      title: 'Card 5 · Compute Pressure + FinalizationRegistry / WeakRef',
      extra: h(Tag, { color: s.pressureSupported ? 'primary' : 'error' },
        s.pressureSupported ? '实验性' : '不可用'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'PressureObserver 监听 CPU 压力状态（nominal/fair/serious/critical）；' +
        'FinalizationRegistry 在对象被 GC 时回调；WeakRef 持有弱引用，deref() 可能返回 undefined。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('启动 PressureObserver', {
          type: 'primary', size: 'sm',
          onClick: () => this._initPressureObserver(),
          disabled: !s.pressureSupported,
        }),
        this._btn('停止', {
          size: 'sm', danger: true,
          onClick: () => this._stopPressureObserver(),
          disabled: !s.pressureSupported,
        }),
        h(Tag, { color: 'primary' }, `state: ${s.pressureState}`),
        h(Tag, { color: 'default' }, `事件数: ${s.pressureCount}`),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('FinalizationRegistry 演示', {
          size: 'sm',
          onClick: () => this._testFinalizationRegistry(),
        }),
        this._btn('WeakRef 演示', {
          size: 'sm',
          onClick: () => this._testWeakRef(),
        }),
        s.weakRefAlive !== null
          ? h(Tag, { color: s.weakRefAlive ? 'success' : 'warning' },
              `WeakRef deref: ${s.weakRefAlive ? '存活' : 'undefined'}`)
          : null,
      ),
      h('pre', { class: 'code-block mt-md' },
`// PressureObserver
const obs = new PressureObserver((records) => {
  for (const r of records) { /* r.source / r.state / r.time */ }
});
obs.observe('cpu');
// FinalizationRegistry：对象 GC 时回调
const reg = new FinalizationRegistry((held) => console.log('GC', held));
reg.register(obj, 'my-held-value');
// WeakRef：弱引用，deref() 可能返回 undefined
const ref = new WeakRef(bigObj); ref.deref();`),
    );
  }

  // =================== 整页渲染 ===================

  renderPage(): Node | string | (Node | string)[] {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, '并发与通信 API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'SharedWorker · MessageChannel · SharedArrayBuffer/Atomics · Scheduler · Compute Pressure · FinalizationRegistry · WeakRef',
        description: '本页演示浏览器中“并发与跨上下文通信”相关 API。部分 API 需要特殊 HTTP 头或较新内核，所有调用前都会做能力检测，不可用时记日志说明。',
      }),

      h('div', { class: 'grid grid-2 gap-md' },
        this._renderSharedWorkerCard(),
        this._renderMessageChannelCard(),
      ),
      h('div', { class: 'grid grid-2 gap-md mt-md' },
        this._renderSABCard(),
        this._renderSchedulerCard(),
      ),
      h('div', { class: 'mt-md' }, this._renderPressureCard()),

      // 兼容性提示
      h(Alert, {
        type: 'warning',
        message: '兼容性提示',
        description: 'SharedWorker：Firefox/Safari 部分支持，移动端基本不支持；SharedArrayBuffer：必须 crossOriginIsolated=true（COOP+COEP）；Atomics.waitAsync：Chromium 87+；Scheduler API：Chromium 94+，本页回退到 setTimeout/queueMicrotask；PressureObserver：Chromium 125+ 需 HTTPS；FinalizationRegistry/WeakRef：现代浏览器均支持，GC 时机由引擎决定。',
      }),

      this._renderLogPanel(),
    
    ] as (Node | string)[];
  }
}
