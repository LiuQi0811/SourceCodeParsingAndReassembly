// StreamsPage.js —— 流式 Web API 实验室
// 演示 MDN：Streams API（ReadableStream / WritableStream / TransformStream）、
//           AbortController / AbortSignal（含 timeout / any 静态方法）、
//           Beacon API（navigator.sendBeacon）、EventSource（Server-Sent Events / SSE）
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// EventSource readyState 文本映射（0/1/2）
const SSE_STATES = ['CONNECTING', 'OPEN', 'CLOSED'];

export class StreamsPage extends Page {
  initialState() {
    return {
      logs: [],
      streamProgress: '',        // Card 1: Streams
      streamRunning: false,
      abortStatus: '空闲',       // Card 2: AbortController
      abortReason: '',
      beaconSent: 0,             // Card 3: Beacon API
      beaconSupported: typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function',
      sseState: '未连接',        // Card 4: EventSource
      sseMessages: [],
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // 这些都是用户触发的演示，不在挂载时自动启动任何循环
    // 仅注册 visibilitychange 监听，演示 beacon 在 unload 类场景下的发送
    if (this._visInited) return; // 防止 _rerender 后重复进入导致 rAF 链爆炸
    this._visInited = true;
    this._onVisChange = () => {
      if (document.visibilityState === 'hidden' && this.state.beaconSupported) {
        try {
          const payload = JSON.stringify({ event: 'visibilitychange:hidden', t: Date.now() });
          const ok = navigator.sendBeacon('https://httpbin.org/post',
            new Blob([payload], { type: 'application/json' }));
          // 页面即将卸载时不能依赖 DOM 日志刷新，仅控制台留痕
          console.log('[StreamsPage] hidden 时 sendBeacon =>', ok);
        } catch (err) {
          console.warn('[StreamsPage] hidden 时 sendBeacon 失败', err);
        }
      }
    };
    document.addEventListener('visibilitychange', this._onVisChange);
    this._addLog('beacon', this.state.beaconSupported
      ? 'navigator.sendBeacon 可用，visibilitychange 监听已注册'
      : 'navigator.sendBeacon 不可用');
  }

  componentWillUnmount() {
    this._closeSse();                                  // 关闭 EventSource
    this._abortActiveController();                     // 中止慢 fetch 演示
    if (this._simSseCtrl) {                            // 中止模拟 SSE
      try { this._simSseCtrl.abort('page-unmount'); } catch { /* noop */ }
      this._simSseCtrl = null;
    }
    if (this._activeReader) {                          // 关闭可能残留的 stream reader
      try { this._activeReader.cancel('page-unmount'); } catch { /* noop */ }
      this._activeReader = null;
    }
    // 清除 ReadableStream start() 内部创建的 setInterval 句柄，
    // 避免页面卸载后定时器仍触发并操作已关闭的 controller 抛 "Controller is already closed"。
    if (this._streamTimers) {
      this._streamTimers.forEach((t) => { try { clearInterval(t); } catch { /* noop */ } });
      this._streamTimers.clear();
    }
    if (this._onVisChange) {                           // 移除 visibilitychange 监听
      document.removeEventListener('visibilitychange', this._onVisChange);
      this._onVisChange = null;
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

  // =================== 1. Streams API ===================

  // 1a. ReadableStream 基础：getReader + read 循环
  async _demoReadLoop() {
    if (typeof ReadableStream === 'undefined') return this._addLog('err', 'ReadableStream 不可用');
    try {
      this._addLog('stream', '【read 循环】创建 push-based ReadableStream，将入队 4 个字符串 chunk');
      const stream = new ReadableStream({
        start: (controller) => {
          const chunks = ['Hello', ',', 'Streams', '!'];
          let i = 0;
          const timer = setInterval(() => {
            if (i >= chunks.length) { clearInterval(timer); try { controller.close(); } catch { /* noop */ } return; }
            try { controller.enqueue(chunks[i++]); } catch { /* noop */ }
          }, 100);
          // 登记到 this._streamTimers 供 componentWillUnmount 清理，避免离页后定时器继续触发已关闭的 controller
          if (!this._streamTimers) this._streamTimers = new Set();
          this._streamTimers.add(timer);
        },
      });
      const reader = stream.getReader();
      this._activeReader = reader;
      let received = '', count = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          this._addLog('stream', `read 循环结束（done=true），共读取 ${count} 个 chunk`);
          break;
        }
        received += value;
        count++;
        this._addLog('stream', `read() => chunk#${count} = ${JSON.stringify(value)}（累计 ${new TextEncoder().encode(received).byteLength}B）`);
      }
      this._addLog('stream', `拼接结果：${received}`);
      this._activeReader = null;
    } catch (err) {
      this._addLog('err', `read 循环异常：${err.message}`);
    }
  }

  // 1b. async iteration: for await (const chunk of stream)
  async _demoAsyncIter() {
    if (typeof ReadableStream === 'undefined') return this._addLog('err', 'ReadableStream 不可用');
    // 检测异步迭代支持（较老环境可能未实现）
    const hasAsyncIter = typeof ReadableStream.prototype.values === 'function'
      || typeof ReadableStream.prototype[Symbol.asyncIterator] === 'function';
    if (!hasAsyncIter) return this._addLog('err', 'ReadableStream 异步迭代不被当前环境支持');
    try {
      this._addLog('stream', '【async iteration】使用 for await...of 遍历 ReadableStream');
      const stream = new ReadableStream({
        start(controller) {
          ['流', '式', '迭', '代'].forEach((c) => controller.enqueue(c));
          controller.close();
        },
      });
      let collected = '', count = 0;
      try {
        for await (const chunk of stream) {
          collected += chunk;
          count++;
          this._addLog('stream', `for await => chunk#${count} = ${JSON.stringify(chunk)}`);
        }
      } catch (iterErr) {
        this._addLog('err', `迭代被中断：${iterErr.message}`);
      }
      this._addLog('stream', `迭代结束，共 ${count} 个 chunk，拼接：${collected}`);
    } catch (err) {
      this._addLog('err', `async iteration 异常：${err.message}`);
    }
  }

  // 1c. tee() 分叉一个流为两个独立消费
  async _demoTee() {
    if (typeof ReadableStream === 'undefined') return this._addLog('err', 'ReadableStream 不可用');
    try {
      this._addLog('stream', '【tee】将一个流分叉为两个独立消费的流');
      const src = new ReadableStream({
        start(controller) { [1, 2, 3].forEach((n) => controller.enqueue(n)); controller.close(); },
      });
      const [a, b] = src.tee();
      const ra = a.getReader(), rb = b.getReader();
      const aOut = [], bOut = [];
      while (true) { // 交替读取两个分支（实际场景可并行）
        const r1 = await ra.read();
        if (r1.done) break;
        aOut.push(r1.value);
        const r2 = await rb.read();
        if (r2.done) break;
        bOut.push(r2.value);
      }
      this._addLog('stream', `tee 分支 A 读取：[${aOut.join(', ')}]`);
      this._addLog('stream', `tee 分支 B 读取：[${bOut.join(', ')}]`);
      this._addLog('stream', '两个分支独立消费完成');
    } catch (err) {
      this._addLog('err', `tee 异常：${err.message}`);
    }
  }

  // 1d. 完整流水线：ReadableStream → TransformStream → WritableStream
  async _runPipeline() {
    if (typeof ReadableStream === 'undefined' || typeof TransformStream === 'undefined'
      || typeof WritableStream === 'undefined') {
      return this._addLog('err', 'Streams API（ReadableStream/TransformStream/WritableStream）不完整');
    }
    if (this.state.streamRunning) return this._addLog('stream', '流水线运行中，请稍候');
    this.setState({ streamRunning: true, streamProgress: '启动中...' });
    try {
      this._addLog('stream', '【pipeline】启动：source → uppercase TransformStream → WritableStream sink');
      const sourceWords = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
      const source = new ReadableStream({
        start: (controller) => {
          let i = 0;
          const timer = setInterval(() => {
            if (i >= sourceWords.length) { clearInterval(timer); try { controller.close(); } catch { /* noop */ } return; }
            try { controller.enqueue(sourceWords[i++]); } catch { /* noop */ }
          }, 150);
          if (!this._streamTimers) this._streamTimers = new Set();
          this._streamTimers.add(timer);
        },
      });
      const upper = new TransformStream({ // 自定义转换：转大写
        transform(chunk, controller) { controller.enqueue(chunk.toUpperCase()); },
      });
      const sink = [];
      let totalBytes = 0;
      const writable = new WritableStream({ // sink：收集结果
        write(chunk) { sink.push(chunk); totalBytes += new TextEncoder().encode(chunk).byteLength; },
      });
      this._addLog('stream', '开始 pipeThrough(uppercase) ...');
      const transformed = source.pipeThrough(upper);
      this._addLog('stream', '开始 pipeTo(writable sink) ...');
      await transformed.pipeTo(writable);
      this._addLog('stream', `流水线完成：${sink.length} 个 chunk，共 ${totalBytes} 字节，结果 = [${sink.join(', ')}]`);
      this.setState({ streamProgress: `完成：${sink.length} chunk / ${totalBytes}B，结果 [${sink.join(', ')}]` });
    } catch (err) {
      this._addLog('err', `流水线异常：${err.message}`);
      this.setState({ streamProgress: `异常：${err.message}` });
    } finally {
      this.setState({ streamRunning: false });
    }
  }

  // =================== 2. AbortController / AbortSignal ===================

  _abortActiveController() {
    if (this._abortCtrl) {
      try { if (!this._abortCtrl.signal.aborted) this._abortCtrl.abort('page-unmount'); } catch { /* noop */ }
      this._abortCtrl = null;
    }
  }

  // 2a. 慢 fetch + 手动 abort
  async _startSlowFetch() {
    if (typeof AbortController === 'undefined') return this._addLog('err', 'AbortController 不可用');
    if (this._abortCtrl) return this._addLog('abort', '已有进行中的请求，请先中止或等待');
    const ctrl = new AbortController();
    this._abortCtrl = ctrl;
    ctrl.signal.addEventListener('abort', () => {
      this._addLog('abort', `abort 事件触发，aborted=${ctrl.signal.aborted}，reason=${JSON.stringify(ctrl.signal.reason)}`);
    });
    this.setState({ abortStatus: '请求中...', abortReason: '' });
    this._addLog('abort', '【手动 abort】开始请求 https://httpbin.org/delay/5（约 5s 后响应）');
    try {
      const resp = await fetch('https://httpbin.org/delay/5', { signal: ctrl.signal });
      this._addLog('abort', `fetch 完成：HTTP ${resp.status}（未被中止）`);
      this.setState({ abortStatus: `完成（HTTP ${resp.status}）` });
    } catch (err) {
      if (err.name === 'AbortError') {
        this._addLog('abort', `fetch 被 AbortError 中止，reason=${JSON.stringify(ctrl.signal.reason)}`);
        this.setState({ abortStatus: '已中止', abortReason: String(ctrl.signal.reason) });
      } else {
        this._addLog('err', `fetch 失败：${err.name} - ${err.message}`);
        this.setState({ abortStatus: `失败：${err.message}` });
      }
    } finally {
      this._abortCtrl = null;
    }
  }

  _abortFetch() {
    if (!this._abortCtrl) return this._addLog('abort', '当前没有可中止的请求');
    try {
      this._abortCtrl.abort('user-clicked-abort');
      this._addLog('abort', '已调用 controller.abort("user-clicked-abort")');
    } catch (err) {
      this._addLog('err', `abort 调用异常：${err.message}`);
    }
  }

  // 2b. AbortSignal.timeout(ms) 静态方法
  async _demoTimeoutSignal() {
    if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
      return this._addLog('err', 'AbortSignal.timeout 静态方法不可用（需较新浏览器）');
    }
    this._addLog('abort', '【timeout】使用 AbortSignal.timeout(800) 自动中止 fetch');
    const signal = AbortSignal.timeout(800);
    signal.addEventListener('abort', () => {
      this._addLog('abort', `timeout signal 触发 abort，reason=${JSON.stringify(signal.reason)}`);
    });
    try {
      const resp = await fetch('https://httpbin.org/delay/3', { signal });
      this._addLog('abort', `timeout demo fetch 完成：HTTP ${resp.status}（未超时）`);
    } catch (err) {
      if (err.name === 'TimeoutError') {
        this._addLog('abort', `TimeoutError：800ms 超时自动中止，signal.reason=${JSON.stringify(signal.reason)}`);
      } else if (err.name === 'AbortError') {
        this._addLog('abort', 'AbortError：信号被中止');
      } else {
        this._addLog('err', `timeout demo 失败：${err.name} - ${err.message}`);
      }
    }
  }

  // 2c. AbortSignal.any([sig1, sig2]) 组合多个信号
  async _demoSignalAny() {
    if (typeof AbortSignal === 'undefined' || typeof AbortSignal.any !== 'function') {
      return this._addLog('err', 'AbortSignal.any 静态方法不可用（需较新浏览器）');
    }
    this._addLog('abort', '【any】组合 timeout(2000) + 手动 controller 信号');
    const ctrl = new AbortController();
    const combined = AbortSignal.any([AbortSignal.timeout(2000), ctrl.signal]);
    combined.addEventListener('abort', () => {
      this._addLog('abort', `combined signal 触发 abort，aborted=${combined.aborted}，reason=${JSON.stringify(combined.reason)}`);
    });
    // 600ms 后手动 abort，验证 combined 立即生效（早于 2000ms 超时）
    setTimeout(() => { try { ctrl.abort('manual-before-timeout'); } catch { /* noop */ } }, 600);
    try {
      const resp = await fetch('https://httpbin.org/delay/5', { signal: combined });
      this._addLog('abort', `any demo fetch 完成：HTTP ${resp.status}`);
    } catch (err) {
      if (err.name === 'AbortError') this._addLog('abort', 'any demo 被 AbortError 中止（来自 combined 信号）');
      else if (err.name === 'TimeoutError') this._addLog('abort', 'any demo 被 TimeoutError 中止');
      else this._addLog('err', `any demo 失败：${err.name} - ${err.message}`);
    }
  }

  // =================== 3. Beacon API ===================

  _sendBeaconJson() {
    if (!this.state.beaconSupported) return this._addLog('err', 'navigator.sendBeacon 不可用');
    try {
      const payload = { event: 'api-lab-click', page: 'streams', ts: Date.now(), ua: navigator.userAgent.slice(0, 40) };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' }); // 指定 MIME
      const ok = navigator.sendBeacon('https://httpbin.org/post', blob);
      this._addLog('beacon', `sendBeacon(JSON Blob) => ${ok}，payload ${blob.size}B`);
      this.setState({ beaconSent: this.state.beaconSent + 1 });
    } catch (err) {
      this._addLog('err', `sendBeacon(JSON) 异常：${err.message}`);
    }
  }

  _sendBeaconForm() {
    if (!this.state.beaconSupported) return this._addLog('err', 'navigator.sendBeacon 不可用');
    try {
      // URLSearchParams 表单编码（Content-Type: application/x-www-form-urlencoded）
      const params = new URLSearchParams();
      params.set('event', 'form-encoded');
      params.set('source', 'streams-page');
      params.set('n', String(this.state.beaconSent));
      const ok = navigator.sendBeacon('https://httpbin.org/post', params);
      this._addLog('beacon', `sendBeacon(URLSearchParams) => ${ok}，body=${params.toString()}`);
      this.setState({ beaconSent: this.state.beaconSent + 1 });
    } catch (err) {
      this._addLog('err', `sendBeacon(form) 异常：${err.message}`);
    }
  }

  async _compareKeepalive() {
    // fetch(..., { keepalive: true }) 与 sendBeacon 的对照
    try {
      this._addLog('beacon', '【对比】使用 fetch(..., { keepalive: true }) 发送同等载荷');
      const resp = await fetch('https://httpbin.org/post', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'keepalive-fetch', ts: Date.now() }),
      });
      this._addLog('beacon', `fetch keepalive 完成：HTTP ${resp.status}（与 sendBeacon 不同，可读取响应）`);
    } catch (err) {
      this._addLog('err', `fetch keepalive 失败：${err.message}`);
    }
  }

  // =================== 4. EventSource (SSE) ===================

  _closeSse() {
    if (this._sse) {
      try {
        // 清空事件处理器避免触发多余的 onerror 日志
        this._sse.onopen = null;
        this._sse.onmessage = null;
        this._sse.onerror = null;
        if (this._sse.readyState !== 2) this._sse.close();
      } catch { /* noop */ }
      this._sse = null;
      this.setState({ sseState: '已关闭' });
    }
  }

  _connectSse() {
    if (typeof EventSource === 'undefined') return this._addLog('err', 'EventSource 不可用');
    if (this._sse) {
      this._addLog('sse', '已存在 EventSource 连接，先关闭再重连');
      this._closeSse();
    }
    try {
      this._addLog('sse', '【EventSource】连接 https://http-org.events/events ...');
      this.setState({ sseState: SSE_STATES[0] });
      const es = new EventSource('https://http-org.events/events');
      this._sse = es;
      es.onopen = () => {
        this.setState({ sseState: SSE_STATES[es.readyState] || 'OPEN' });
        this._addLog('sse', `onopen：连接已建立，readyState=OPEN(${es.readyState})`);
      };
      es.onmessage = (e) => {
        this._addLog('sse', `onmessage(data)：${e.data}`);
        this.setState({ sseMessages: [...this.state.sseMessages, { type: 'message', data: e.data, time: formatTime() }].slice(-20) });
      };
      es.onerror = () => {
        const st = SSE_STATES[es.readyState] || `UNKNOWN(${es.readyState})`;
        this.setState({ sseState: st });
        this._addLog('err', `onerror：EventSource 状态=${st}（公共端点可能不可达，浏览器会自动重连）`);
      };
    } catch (err) {
      this._addLog('err', `EventSource 异常：${err.message}`);
    }
  }

  // 「模拟 SSE」：用 fetch 流读取 + 解析 `data:` 行，兼容性更佳
  async _simulateSseViaFetch() {
    if (typeof ReadableStream === 'undefined') return this._addLog('err', 'ReadableStream 不可用，无法模拟 SSE');
    if (this._simSseCtrl) {
      this._addLog('sse', '已有进行中的模拟 SSE，先中止');
      try { this._simSseCtrl.abort('restart'); } catch { /* noop */ }
      this._simSseCtrl = null;
    }
    const ctrl = new AbortController();
    this._simSseCtrl = ctrl;
    this._addLog('sse', '【模拟 SSE】通过 fetch + ReadableStream 解析 data: 行');
    try {
      const resp = await fetch('https://httpbin.org/stream/5', { signal: ctrl.signal }); // 5 行 JSON 文本流
      if (!resp.ok) return this._addLog('err', `fetch /stream/5 失败：HTTP ${resp.status}`);
      if (!resp.body) return this._addLog('err', 'resp.body 不可用（浏览器不支持流式响应体）');
      const reader = resp.body.getReader();
      this._activeReader = reader;
      const decoder = new TextDecoder();
      let buf = '', eventCount = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE 以 \n 分隔行，\n\n 分隔事件；这里逐行解析 data: 前缀
        let sep;
        while ((sep = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, sep).trim();
          buf = buf.slice(sep + 1);
          if (!line) continue;
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            eventCount++;
            this._addLog('sse', `解析 data: 事件 #${eventCount} => ${data}`);
            this.setState({ sseMessages: [...this.state.sseMessages, { type: 'data', data, time: formatTime() }].slice(-20) });
          } else {
            const preview = line.length > 60 ? line.slice(0, 60) + '...' : line;
            this._addLog('sse', `非 data: 行：${preview}`);
          }
        }
      }
      this._addLog('sse', `模拟 SSE 结束，共解析 ${eventCount} 个 data: 事件`);
      this._activeReader = null;
    } catch (err) {
      if (err.name === 'AbortError') this._addLog('sse', '模拟 SSE 被中止');
      else this._addLog('err', `模拟 SSE 异常：${err.message}`);
    } finally {
      this._simSseCtrl = null;
    }
  }

  _abortSimSse() {
    if (this._simSseCtrl) { try { this._simSseCtrl.abort('user-stop'); } catch { /* noop */ } }
    if (this._activeReader) {
      try { this._activeReader.cancel('user-stop'); } catch { /* noop */ }
      this._activeReader = null;
    }
  }

  // =================== 渲染 ===================
  renderPage() {
    const hasStreams = typeof ReadableStream !== 'undefined';
    const hasAbort = typeof AbortController !== 'undefined';
    const hasBeacon = this.state.beaconSupported;
    const hasSse = typeof EventSource !== 'undefined';

    return [
      h('h2', { class: 'section-title' }, '流式 Web API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'Streams API / AbortController / Beacon API / EventSource（SSE）',
        description: '四大流式与异步投递 Web API 综合演示。所有操作日志输出在页面底部日志面板，便于追踪事件流转与状态变迁。',
      }),

      // ============ 1. Streams API ============
      h(Card, {
        title: '1. Streams API（ReadableStream / WritableStream / TransformStream）',
        extra: h(Tag, { color: 'primary' }, 'Streams'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'ReadableStream 提供可读数据流：通过 getReader().read() 循环或 for await...of 异步迭代消费；tee() 将流分叉为两个；pipeThrough(TransformStream) 应用转换；pipeTo(WritableStream) 写入 sink。下面演示完整流水线。'),
          !hasStreams
            ? h(Alert, { type: 'warning', message: '当前环境不支持 Streams API（ReadableStream 未定义）' })
            : h('div', { class: 'flex items-center gap-sm flex-wrap' },
                this._btn('read 循环', { type: 'primary', size: 'sm', onClick: () => this._demoReadLoop() }),
                this._btn('for await 迭代', { type: 'primary', size: 'sm', onClick: () => this._demoAsyncIter() }),
                this._btn('tee() 分叉', { size: 'sm', onClick: () => this._demoTee() }),
                this._btn('运行完整流水线', { type: 'primary', size: 'sm', onClick: () => this._runPipeline() }),
              ),
          this.state.streamProgress && h('div', { class: 'fs-sm fw-medium' }, this.state.streamProgress),
        ),
      ),

      // ============ 2. AbortController / AbortSignal ============
      h(Card, {
        title: '2. AbortController / AbortSignal（中止异步操作）',
        extra: h(Tag, { color: this.state.abortStatus === '已中止' ? 'warning' : 'default' }, this.state.abortStatus),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'new AbortController() 创建控制器，将 controller.signal 传入 fetch(..., { signal }) 即可中止。AbortSignal.timeout(ms) 自动超时；AbortSignal.any([...]) 组合多个信号；signal.aborted / signal.reason 反映中止状态与原因。'),
          !hasAbort
            ? h(Alert, { type: 'warning', message: '当前环境不支持 AbortController' })
            : h('div', { class: 'flex items-center gap-sm flex-wrap' },
                this._btn('启动慢请求', { type: 'primary', size: 'sm', onClick: () => this._startSlowFetch() }),
                this._btn('中止请求', { danger: true, size: 'sm', onClick: () => this._abortFetch() }),
                this._btn('AbortSignal.timeout', { size: 'sm', onClick: () => this._demoTimeoutSignal() }),
                this._btn('AbortSignal.any', { size: 'sm', onClick: () => this._demoSignalAny() }),
              ),
          this.state.abortReason && h('div', { class: 'fs-sm text-secondary' }, `reason: ${this.state.abortReason}`),
        ),
      ),

      // ============ 3. Beacon API ============
      h(Card, {
        title: '3. Beacon API（navigator.sendBeacon）',
        extra: h(Tag, { color: 'success' }, `已发送 ${this.state.beaconSent} 次`),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'navigator.sendBeacon(url, data) 是 fire-and-forget 的 POST 投递，专为页面卸载场景设计。可用 Blob 指定 application/json，或用 URLSearchParams 表单编码。与 fetch(..., { keepalive: true }) 相比，sendBeacon 无法读取响应，但卸载时更可靠。'),
          !hasBeacon
            ? h(Alert, { type: 'warning', message: '当前环境不支持 navigator.sendBeacon' })
            : h('div', { class: 'flex items-center gap-sm flex-wrap' },
                this._btn('发送 JSON Beacon', { type: 'primary', size: 'sm', onClick: () => this._sendBeaconJson() }),
                this._btn('发送表单 Beacon', { type: 'primary', size: 'sm', onClick: () => this._sendBeaconForm() }),
                this._btn('对比 fetch keepalive', { size: 'sm', onClick: () => this._compareKeepalive() }),
              ),
          h('p', { class: 'fs-sm text-tertiary' },
            '提示：页面切到后台（visibilitychange => hidden）会自动发送一条 beacon，演示卸载场景下的可靠投递（详见控制台）。'),
        ),
      ),

      // ============ 4. EventSource (SSE) ============
      h(Card, {
        title: '4. EventSource（Server-Sent Events / SSE）',
        extra: h(Tag, { color: this.state.sseState === 'OPEN' ? 'success' : 'default' }, this.state.sseState),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'new EventSource(url) 建立长连接接收 server push。onopen/onmessage/onerror 反映状态流转，readyState 0=CONNECTING / 1=OPEN / 2=CLOSED，close() 主动断开。公共 SSE 端点可能不可达；「模拟 SSE」按钮用 fetch + ReadableStream 解析 data: 行作为兼容降级方案。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            !hasSse
              ? h(Alert, { type: 'warning', message: '当前环境不支持 EventSource，仍可使用「模拟 SSE」' })
              : this._btn('连接 EventSource', { type: 'primary', size: 'sm', onClick: () => this._connectSse() }),
            this._btn('关闭 EventSource', { danger: true, size: 'sm', onClick: () => this._closeSse() }),
            this._btn('模拟 SSE（fetch 流）', { type: 'primary', size: 'sm', onClick: () => this._simulateSseViaFetch() }),
            this._btn('中止模拟 SSE', { danger: true, size: 'sm', onClick: () => this._abortSimSse() }),
          ),
          this.state.sseMessages.length === 0
            ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无 SSE 消息）')
            : h('div', { class: 'log-panel' },
              ...this.state.sseMessages.map((m) => h('div', { class: 'log-panel__line' },
                h('span', { class: 'log-panel__time' }, m.time),
                h('span', { class: 'log-panel__tag log-panel__tag--sse' }, m.type === 'data' ? 'DATA' : 'MSG'),
                h('span', {}, m.data),
              )),
            ),
        ),
      ),

      // ============ 日志面板 ============
      h(Card, {
        title: '事件日志',
        extra: h(Tag, { color: 'primary' }, `${this.state.logs.length} 条`),
      },
        this.state.logs.length === 0
          ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无日志）')
          : h('div', { class: 'log-panel' },
            ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
              h('span', {}, log.content),
            )),
          ),
      ),
    ];
  }
}
