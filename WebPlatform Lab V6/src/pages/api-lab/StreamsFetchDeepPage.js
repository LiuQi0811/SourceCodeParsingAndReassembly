// =====================================================================
// StreamsFetchDeepPage.js —— 流与 Fetch 深度实验室
// 演示 MDN：
//   1. Fetch API 基础 —— fetch(input, init)、new Request/Response/Headers、
//      response.ok/status/statusText/headers/redirected/type、text()/json()/blob()/clone()。
//   2. AbortController + 超时取消 —— controller.signal (AbortSignal)、aborted/reason/
//      throwIfAborted()、abort(reason)、fetch(url,{signal})、AbortSignal.timeout(ms)、
//      AbortSignal.any([sig1,sig2])、addEventListener('abort',cb)。
//   3. ReadableStream + 流式读取 —— new ReadableStream({start,pull,cancel,type:'bytes'})、
//      getReader().read() → {value,done}、releaseLock/cancel、locked、for await、BYOB Reader。
//   4. WritableStream + TransformStream + 管道 —— write/close/abort/ready/desiredSize、
//      pipeTo/pipeThrough、stream.tee() → [branch1, branch2]。
//   5. 流式 Fetch + 响应体流 —— response.body 是 ReadableStream、getReader 循环读取显示进度、
//      TextDecoderStream 串接：response.body.pipeThrough(new TextDecoderStream())。
// 说明：所有 API 调用前 typeof 能力检测，不可用 _addLog('warn', ...)，绝不抛异常；
//   jsdom 中 fetch/Request/Response/Headers/AbortController 通常有（polyfill 已 mock），
//   ReadableStream/WritableStream/TransformStream 可能不存在（polyfill 中有 mock）。
//   真实 fetch 都用 mock（返回 '[]'），流式响应体用 new Response(ReadableStream) 构造。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class StreamsFetchDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      // 共享事件日志（所有卡片写入同一面板，最多保留 40 条）
      logs: [],
      // 能力检测摘要（componentDidMount 中填充，渲染时非空才显示 Alert）
      capsSummary: '',
      // Card 1：Request 构造信息 + fetch 状态
      reqInfo: '',
      fetchStatus: '空闲',
      // Card 2：AbortController 状态
      abortState: '空闲',
      // Card 3：已读取的 chunk 列表
      streamChunks: [],
      // Card 4：管道 / tee 结果
      pipeResult: '',
      // Card 5：流式下载进度
      bodyProgress: '',
      // Card 6：Headers/Fetch 进阶
      advancedHeadersState: '',
    };
  }

  // —— 生命周期：挂载 ——
  componentDidMount() {
    // ★ 初始化实例引用（幂等赋值，避免 rerender 时丢失已建立的引用）
    if (!this._abortControllers) this._abortControllers = new Set(); // 所有活跃 AbortController
    if (!this._readers) this._readers = [];                          // 所有活跃 reader（releaseLock）
    if (!this._streams) this._streams = [];                          // 所有活跃 stream（cancel）
    if (!this._timers) this._timers = new Set();                     // 所有 setTimeout 句柄
    this._demoStream = null;   // Card 3 构造的可读流
    this._demoReader = null;   // Card 3 单 chunk 读取用的 reader

    if (this._inited) return; this._inited = true;

    // —— 能力检测（绝不抛异常，仅 typeof / in 判定）——
    const hasFetch = typeof fetch === 'function';
    const hasReqRespHeaders =
      typeof Request !== 'undefined' &&
      typeof Response !== 'undefined' &&
      typeof Headers !== 'undefined';
    const hasAbort =
      typeof AbortController !== 'undefined' &&
      typeof AbortSignal !== 'undefined' &&
      typeof AbortSignal.timeout === 'function';
    const hasStreams =
      typeof ReadableStream !== 'undefined' &&
      typeof WritableStream !== 'undefined' &&
      typeof TransformStream !== 'undefined';
    const hasGetReader =
      typeof ReadableStream !== 'undefined' &&
      typeof ReadableStream.prototype.getReader === 'function';
    const hasTextDecoderStream = typeof TextDecoderStream !== 'undefined';

    const summary =
      '能力检测：fetch=' + (hasFetch ? '✓' : '✗') +
      '，Request/Response/Headers=' + (hasReqRespHeaders ? '✓' : '✗') +
      '，AbortController/Signal.timeout=' + (hasAbort ? '✓' : '✗') +
      '，ReadableStream/WritableStream/TransformStream=' + (hasStreams ? '✓' : '✗') +
      '，getReader=' + (hasGetReader ? '✓' : '✗') +
      '，TextDecoderStream=' + (hasTextDecoderStream ? '✓' : '✗');
    this.setState({ capsSummary: summary });
    this._addLog('info', summary);

    if (!hasFetch) this._addLog('warn', 'fetch 不可用，Card 1/2/5 的 fetch 演示将跳过');
    if (!hasReqRespHeaders) this._addLog('warn', 'Request/Response/Headers 不完整，相关演示将跳过');
    if (!hasAbort) this._addLog('warn', 'AbortController/AbortSignal.timeout 不可用，取消演示将受限');
    if (!hasStreams) this._addLog('warn', 'Streams API 不完整，管道演示将跳过');
    if (!hasGetReader) this._addLog('warn', 'ReadableStream.prototype.getReader 不可用，流式读取演示将跳过');
    if (!hasTextDecoderStream) this._addLog('warn', 'TextDecoderStream 不可用，Card 5 解码演示将跳过');
  }

  // —— 生命周期：卸载 ——
  // 中止所有进行中的 fetch（AbortController.abort）、释放 reader.releaseLock、取消流、清除定时器
  componentWillUnmount() {
    // 中止所有进行中的 fetch
    if (this._abortControllers) {
      this._abortControllers.forEach((c) => {
        try { if (c && c.signal && !c.signal.aborted) c.abort('page-unmount'); } catch { /* noop */ }
      });
      this._abortControllers.clear();
    }
    // 释放所有 reader（先 cancel 再 releaseLock）
    if (this._readers) {
      this._readers.forEach((r) => {
        try { if (r && typeof r.cancel === 'function') r.cancel('page-unmount'); } catch { /* noop */ }
        try { if (r && typeof r.releaseLock === 'function') r.releaseLock(); } catch { /* noop */ }
      });
      this._readers = [];
    }
    // 取消所有活跃流（locked 状态下不可 cancel，需先释放 reader）
    if (this._streams) {
      this._streams.forEach((s) => {
        try { if (s && !s.locked && typeof s.cancel === 'function') s.cancel('page-unmount'); } catch { /* noop */ }
      });
      this._streams = [];
    }
    // 清除所有定时器
    if (this._timers) {
      this._timers.forEach((t) => { try { clearTimeout(t); } catch { /* noop */ } });
      this._timers.clear();
    }
    this._demoStream = null;
    this._demoReader = null;
  }

  // —— 共享日志方法 ——
  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  // —— 按钮工厂：new Button + registerChild + render ——
  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— Card 工厂：new Card({ title, desc, extra, children }) + registerChild + render ——
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

  // —— 内部辅助：登记 AbortController / reader / stream / timer ——
  _trackAbort(c) { if (c) this._abortControllers.add(c); return c; }
  _untrackAbort(c) { try { this._abortControllers.delete(c); } catch { /* noop */ } }
  _trackReader(r) { if (r) this._readers.push(r); return r; }
  _untrackReader(r) {
    try { const i = this._readers.indexOf(r); if (i >= 0) this._readers.splice(i, 1); } catch { /* noop */ }
  }
  _trackStream(s) { if (s) this._streams.push(s); return s; }
  _setTimer(fn, ms) { const id = setTimeout(fn, ms); this._timers.add(id); return id; }
  _clearTimer(id) { try { clearTimeout(id); this._timers.delete(id); } catch { /* noop */ } }

  // =================================================================
  // Card 1：Fetch API 基础
  // =================================================================

  // 构造 Request / Headers 对象，展示其结构
  _buildRequest() {
    if (typeof Request === 'undefined' || typeof Headers === 'undefined') {
      this._addLog('warn', 'Request / Headers 不可用，无法构造');
      return;
    }
    try {
      const headers = new Headers();
      headers.append('Content-Type', 'application/json');
      headers.append('X-Trace-Id', 'sf-' + Date.now().toString(36));
      headers.set('Accept', 'application/json');
      // 读取头部：get / has / entries / forEach
      const headerList = [];
      try { headers.forEach((v, k) => headerList.push(`${k}: ${v}`)); } catch { /* noop */ }
      const req = new Request('https://example.com/api/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ page: 1, size: 20 }),
        mode: 'cors',
        credentials: 'same-origin',
        cache: 'no-cache',
        redirect: 'follow',
        referrer: 'client',
        integrity: '',
      });
      const info =
        'Request.url = ' + req.url + '\n' +
        'Request.method = ' + req.method + '\n' +
        'Request.mode = ' + req.mode + '\n' +
        'Request.credentials = ' + req.credentials + '\n' +
        'Request.cache = ' + req.cache + '\n' +
        'Request.redirect = ' + req.redirect + '\n' +
        'Headers（forEach 遍历）：\n  ' + (headerList.join('\n  ') || '（空）');
      this.setState({ reqInfo: info });
      this._addLog('req', `已构造 Request(${req.method} ${req.url})，Headers 共 ${headerList.length} 项`);
    } catch (err) {
      this._addLog('warn', '构造 Request 失败：' + (err && err.message));
    }
  }

  // 发送 fetch（mock 立即返回 '[]'），展示 Response 各属性
  async _sendFetch() {
    if (typeof fetch !== 'function') {
      this._addLog('warn', 'fetch 不可用');
      return;
    }
    this.setState({ fetchStatus: '请求中...' });
    this._addLog('fetch', '【发送 fetch】GET https://example.com/api/list（mock 将返回 "[]"）');
    try {
      const resp = await fetch('https://example.com/api/list');
      let typeStr = '—';
      try { typeStr = resp.type; } catch { /* noop */ }
      const hs = [];
      try { resp.headers.forEach((v, k) => hs.push(`${k}: ${v}`)); } catch { /* noop */ }
      let bodyText = '';
      try { bodyText = await resp.text(); } catch { /* noop */ }
      const respInfo =
        'response.ok = ' + resp.ok + '\n' +
        'response.status = ' + resp.status + '\n' +
        'response.statusText = ' + resp.statusText + '\n' +
        'response.type = ' + typeStr + '\n' +
        'response.redirected = ' + resp.redirected +
        '\n响应头：\n  ' + (hs.join('\n  ') || '（无）') + '\n响应体：' + bodyText;
      this._addLog('fetch', `fetch 完成：ok=${resp.ok}，status=${resp.status}，type=${typeStr}，body=${JSON.stringify(bodyText)}`);
      this.setState({ fetchStatus: `完成（HTTP ${resp.status}）`, reqInfo: respInfo });
    } catch (err) {
      this._addLog('warn', 'fetch 失败：' + (err && err.name) + ' - ' + (err && err.message));
      this.setState({ fetchStatus: '失败：' + (err && err.message) });
    }
  }

  _renderCard1() {
    const s = this.state;
    return this._card(
      'Card 1 · Fetch API 基础',
      'fetch(input, init)：init 含 method/headers/body/mode/credentials/cache/redirect/referrer/integrity；' +
      'new Request(url, init) / new Response(body, init) / new Headers()（append/get/set/delete/has/entries/forEach）；' +
      'response.ok/status/statusText/headers/redirected/type("basic"|"cors"|"opaque")；' +
      'response.text()/json()/blob()/arrayBuffer()/formData()/clone()。',
      h(Tag, { color: 'primary' }, 'Fetch'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('构造 Request', {
            type: 'primary', size: 'sm', onClick: () => this._buildRequest(),
          }),
          this._btn('发送 fetch', {
            type: 'primary', size: 'sm', onClick: () => this._sendFetch(),
          }),
          h(Tag, { color: s.fetchStatus === '空闲' ? 'default' : 'success' }, s.fetchStatus),
        ),
        s.reqInfo
          ? h('pre', { class: 'code-block mt-md', style: { maxHeight: '220px' } }, s.reqInfo)
          : null,
        h('pre', { class: 'code-block mt-md' },
`fetch(input, init);   // init: { method, headers, body, mode, credentials, cache, redirect, referrer, integrity }
new Request(url, init); new Response(body, init); new Headers();
h.append(name, value); h.get/set/delete/has(name); h.entries(); h.forEach(cb);
resp.ok; resp.status; resp.statusText; resp.headers; resp.redirected; resp.type; // 'basic'|'cors'|'opaque'
resp.text(); resp.json(); resp.blob(); resp.arrayBuffer(); resp.formData(); resp.clone();`),
      ],
    );
  }

  // =================================================================
  // Card 2：AbortController + 超时取消
  // =================================================================

  // 发起可取消的 fetch，5 秒后自动 abort
  async _startAbortableFetch() {
    if (typeof AbortController === 'undefined') {
      this._addLog('warn', 'AbortController 不可用');
      return;
    }
    if (typeof fetch !== 'function') {
      this._addLog('warn', 'fetch 不可用');
      return;
    }
    if (this._abortCtrl) {
      this._addLog('abort', '已有进行中的请求，请先取消或等待');
      return;
    }
    const ctrl = new AbortController();
    this._abortCtrl = ctrl;
    this._trackAbort(ctrl);
    // 监听 abort 事件
    try {
      ctrl.signal.addEventListener('abort', () => {
        let reason = '—';
        try { reason = JSON.stringify(ctrl.signal.reason); } catch { reason = String(ctrl.signal.reason); }
        this._addLog('abort', `abort 事件触发：aborted=${ctrl.signal.aborted}，reason=${reason}`);
      });
    } catch { /* noop */ }
    this.setState({ abortState: '请求中（5s 后自动 abort）' });
    this._addLog('abort', '【可取消 fetch】发起请求 https://example.com/slow，5s 后自动 abort');
    // 5s 后自动 abort（真实环境可中断未完成的 fetch；mock 下 fetch 已返回，abort 仍触发事件）
    this._autoAbortTimer = this._setTimer(() => {
      try { if (ctrl.signal && !ctrl.signal.aborted) ctrl.abort('5s-auto-timeout'); } catch { /* noop */ }
    }, 5000);
    try {
      const resp = await fetch('https://example.com/slow', { signal: ctrl.signal });
      this._addLog('abort', `fetch 完成：HTTP ${resp.status}（未被中止，mock 环境立即返回）`);
      this.setState({ abortState: '完成（HTTP ' + resp.status + '）' });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        let reason = '—';
        try { reason = JSON.stringify(ctrl.signal.reason); } catch { reason = String(ctrl.signal.reason); }
        this._addLog('cancel', `fetch 被 AbortError 中止，reason=${reason}`);
        this.setState({ abortState: '已中止' });
      } else if (err && err.name === 'TimeoutError') {
        this._addLog('cancel', `TimeoutError：${err.message}`);
        this.setState({ abortState: '超时' });
      } else {
        this._addLog('warn', 'fetch 失败：' + (err && err.name) + ' - ' + (err && err.message));
        this.setState({ abortState: '失败' });
      }
    } finally {
      if (this._autoAbortTimer) { this._clearTimer(this._autoAbortTimer); this._autoAbortTimer = null; }
      this._untrackAbort(ctrl);
      this._abortCtrl = null;
    }
  }

  // 手动 abort
  _abortFetch() {
    if (!this._abortCtrl) {
      this._addLog('cancel', '当前没有可中止的请求');
      return;
    }
    try {
      this._abortCtrl.abort('user-clicked-abort');
      this._addLog('cancel', '已调用 controller.abort("user-clicked-abort")');
      this.setState({ abortState: '已中止' });
    } catch (err) {
      this._addLog('warn', 'abort 调用异常：' + (err && err.message));
    }
  }

  // AbortSignal.timeout(ms) 静态方法演示
  async _demoTimeoutSignal() {
    if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
      this._addLog('warn', 'AbortSignal.timeout 静态方法不可用（需较新浏览器）');
      return;
    }
    if (typeof fetch !== 'function') {
      this._addLog('warn', 'fetch 不可用');
      return;
    }
    this._addLog('abort', '【timeout】使用 AbortSignal.timeout(800) 自动中止 fetch');
    let signal;
    try { signal = AbortSignal.timeout(800); } catch (err) {
      this._addLog('warn', 'AbortSignal.timeout 创建失败：' + (err && err.message));
      return;
    }
    try {
      signal.addEventListener('abort', () => {
        let reason = '—';
        try { reason = JSON.stringify(signal.reason); } catch { reason = String(signal.reason); }
        this._addLog('abort', `timeout signal 触发 abort：aborted=${signal.aborted}，reason=${reason}`);
      });
    } catch { /* noop */ }
    // throwIfAborted 演示（不抛即未中止）
    try {
      if (typeof signal.throwIfAborted === 'function') {
        signal.throwIfAborted();
        this._addLog('abort', 'throwIfAborted() 未抛出（signal 尚未中止）');
      }
    } catch (err) {
      this._addLog('cancel', 'throwIfAborted 抛出：' + (err && err.message));
    }
    try {
      const resp = await fetch('https://example.com/slow', { signal });
      this._addLog('abort', `timeout demo fetch 完成：HTTP ${resp.status}（未超时）`);
    } catch (err) {
      if (err && err.name === 'TimeoutError') {
        this._addLog('cancel', `TimeoutError：800ms 超时自动中止`);
      } else if (err && err.name === 'AbortError') {
        this._addLog('cancel', 'AbortError：信号被中止');
      } else {
        this._addLog('warn', 'timeout demo 失败：' + (err && err.name) + ' - ' + (err && err.message));
      }
    }
  }

  _renderCard2() {
    const s = this.state;
    const running = s.abortState.startsWith('请求中');
    return this._card(
      'Card 2 · AbortController + 超时取消',
      'new AbortController() → controller.signal (AbortSignal)；signal.aborted / signal.reason / signal.throwIfAborted()；' +
      'controller.abort(reason)；fetch(url, { signal })；AbortSignal.timeout(ms) 静态方法（自动超时）；' +
      'AbortSignal.any([sig1, sig2]) 组合；signal.addEventListener("abort", cb)。',
      h(Tag, { color: running ? 'warning' : (s.abortState === '已中止' ? 'error' : 'default') }, s.abortState),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('开始 fetch', {
            type: 'primary', size: 'sm', onClick: () => this._startAbortableFetch(),
            disabled: running,
          }),
          this._btn('取消 (abort)', {
            danger: true, size: 'sm', onClick: () => this._abortFetch(),
            disabled: !running,
          }),
          this._btn('AbortSignal.timeout 演示', {
            size: 'sm', onClick: () => this._demoTimeoutSignal(),
          }),
        ),
        h('pre', { class: 'code-block mt-md' },
`const ctrl = new AbortController();
ctrl.signal;                  // AbortSignal
ctrl.signal.aborted;          // boolean
ctrl.signal.reason;           // 中止原因
ctrl.signal.throwIfAborted(); // 若已中止则抛出
ctrl.abort(reason);           // 主动中止
fetch(url, { signal: ctrl.signal });
AbortSignal.timeout(ms);            // 静态方法：自动超时
AbortSignal.any([signal1, signal2]); // 组合多个信号
signal.addEventListener('abort', cb);`),
      ],
    );
  }

  // =================================================================
  // Card 3：ReadableStream + 流式读取
  // =================================================================

  // 构造自定义 ReadableStream，准备逐 chunk 读取
  _buildStream() {
    if (typeof ReadableStream === 'undefined') {
      this._addLog('warn', 'ReadableStream 不可用，无法构造流');
      return;
    }
    this._releaseDemoStream(); // 释放上一次的 reader / stream
    const chunks = ['Hello', ',', 'Stream', '!', '↪', 'chunk-by-chunk'];
    // 构造工厂：type:'bytes' 不被支持时回退为普通流
    const mkStream = (withType) => {
      let i = 0;
      const underlying = {
        start: (controller) => {
          const timer = setInterval(() => {
            if (i >= chunks.length) { clearInterval(timer); try { controller.close(); } catch { /* noop */ } return; }
            try { controller.enqueue(chunks[i++]); } catch { /* noop */ }
          }, 100);
          // 登记到 this._timers 供 componentWillUnmount 清理，避免离页后定时器继续触发已关闭的 controller
          if (this._timers) this._timers.add(timer);
        },
        cancel(reason) { /* 被取消时回调 */ },
      };
      return withType ? new ReadableStream(underlying, { type: 'bytes' }) : new ReadableStream(underlying);
    };
    let stream = null, usedFallback = false;
    try {
      stream = mkStream(true); // 优先尝试 type:'bytes'（启用 BYOB）
    } catch (err) {
      try { stream = mkStream(false); usedFallback = true; } catch (e2) {
        this._addLog('warn', '构造 ReadableStream 失败：' + (e2 && e2.message));
        return;
      }
    }
    this._demoStream = stream;
    this._trackStream(stream);
    this._demoReader = null;
    this.setState({ streamChunks: [] });
    this._addLog('stream', `已构造 ReadableStream${usedFallback ? '（回退，无 type:bytes）' : ''}，将入队 ${chunks.length} 个 chunk（locked=${stream.locked}）`);
  }

  // 读取一个 chunk（每次点击读一个，done 时释放 reader）
  async _readOneChunk() {
    if (typeof ReadableStream === 'undefined') {
      this._addLog('warn', 'ReadableStream 不可用');
      return;
    }
    if (!this._demoStream) {
      this._addLog('stream', '请先点击「构造流」');
      return;
    }
    try {
      // 首次读取时获取 reader（此后流被锁定）
      if (!this._demoReader) {
        this._demoReader = this._demoStream.getReader();
        this._trackReader(this._demoReader);
        this._addLog('stream', `getReader() 已获取，stream.locked=${this._demoStream.locked}`);
      }
      const { done, value } = await this._demoReader.read();
      if (done) {
        this._addLog('chunk', 'read() => done=true，流已关闭');
        try { this._demoReader.releaseLock(); } catch { /* noop */ }
        this._untrackReader(this._demoReader);
        this._demoReader = null;
        return;
      }
      this._addLog('chunk', `read() => chunk=${JSON.stringify(value)}`);
      this.setState({ streamChunks: [...this.state.streamChunks, value].slice(-20) });
    } catch (err) {
      this._addLog('warn', '读取 chunk 失败：' + (err && err.message));
    }
  }

  // for await 异步迭代（若支持）
  async _asyncIterate() {
    if (typeof ReadableStream === 'undefined') {
      this._addLog('warn', 'ReadableStream 不可用');
      return;
    }
    const hasAsyncIter =
      typeof ReadableStream.prototype.values === 'function' ||
      typeof ReadableStream.prototype[Symbol.asyncIterator] === 'function';
    if (!hasAsyncIter) {
      this._addLog('warn', 'ReadableStream 异步迭代不被当前环境支持（需 values()/Symbol.asyncIterator）');
      return;
    }
    try {
      this._addLog('stream', '【for await】使用 for await...of 遍历 ReadableStream');
      const pieces = ['流', '式', '迭', '代', '✓'];
      let i = 0;
      const stream = new ReadableStream({
        start: (controller) => {
          const timer = setInterval(() => {
            if (i >= pieces.length) { clearInterval(timer); try { controller.close(); } catch { /* noop */ } return; }
            try { controller.enqueue(pieces[i++]); } catch { /* noop */ }
          }, 80);
          if (this._timers) this._timers.add(timer);
        },
      });
      this._trackStream(stream);
      let collected = '', count = 0;
      try {
        for await (const chunk of stream) {
          collected += chunk;
          count++;
          this._addLog('chunk', `for await => chunk#${count}=${JSON.stringify(chunk)}`);
          this.setState({ streamChunks: [...this.state.streamChunks, chunk].slice(-20) });
        }
      } catch (iterErr) {
        this._addLog('warn', '迭代被中断：' + (iterErr && iterErr.message));
      }
      this._addLog('stream', `迭代结束：共 ${count} 个 chunk，拼接=${JSON.stringify(collected)}`);
    } catch (err) {
      this._addLog('warn', 'async iteration 异常：' + (err && err.message));
    }
  }

  // 释放 Card 3 demo 流 / reader
  _releaseDemoStream() {
    if (this._demoReader) {
      try { this._demoReader.cancel('rebuild'); } catch { /* noop */ }
      try { this._demoReader.releaseLock(); } catch { /* noop */ }
      this._untrackReader(this._demoReader);
      this._demoReader = null;
    }
    if (this._demoStream) {
      try { if (!this._demoStream.locked) this._demoStream.cancel('rebuild'); } catch { /* noop */ }
      this._demoStream = null;
    }
  }

  _renderCard3() {
    const s = this.state;
    return this._card(
      'Card 3 · ReadableStream + 流式读取',
      'new ReadableStream({ start(controller){ controller.enqueue(chunk); controller.close(); controller.error(e); }, pull(controller), cancel(reason), type:"bytes" })；' +
      'stream.getReader() → reader.read() → { value, done } / reader.releaseLock() / reader.cancel()；' +
      'stream.locked；for await (const chunk of stream) 异步迭代；BYOB Reader：stream.getReader({ mode: "byob" }) / reader.read(view)。',
      h(Tag, { color: 'success' }, 'ReadableStream'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('构造流', {
            type: 'primary', size: 'sm', onClick: () => this._buildStream(),
          }),
          this._btn('读取一个 chunk', {
            type: 'primary', size: 'sm', onClick: () => this._readOneChunk(),
          }),
          this._btn('for await 迭代', {
            size: 'sm', onClick: () => this._asyncIterate(),
          }),
        ),
        s.streamChunks.length > 0
          ? h('div', { class: 'mt-md' },
              h('div', { class: 'fs-sm text-secondary mb-xs' }, `已读取 ${s.streamChunks.length} 个 chunk：`),
              h('div', { class: 'flex items-center gap-xs flex-wrap' },
                ...s.streamChunks.map((c, i) => h(Tag, { color: 'primary' }, `#${i + 1} ${JSON.stringify(c)}`)),
              ),
            )
          : null,
        h('pre', { class: 'code-block mt-md' },
`const stream = new ReadableStream({
  start(controller) { controller.enqueue(chunk); controller.close(); controller.error(e); },
  pull(controller), cancel(reason), type: 'bytes', // type:'bytes' 启用 BYOB
});
const reader = stream.getReader();
const { value, done } = await reader.read();
reader.releaseLock(); reader.cancel(reason);
stream.locked;                  // 是否被 reader 锁定
for await (const chunk of stream) { /* 异步迭代 */ }
const byob = stream.getReader({ mode: 'byob' }); byob.read(new Uint8Array(1024)); // BYOB`),
      ],
    );
  }

  // =================================================================
  // Card 4：WritableStream + TransformStream + 管道
  // =================================================================

  // 管道演示：ReadableStream.pipeThrough(TransformStream).pipeTo(WritableStream)
  async _pipeDemo() {
    if (typeof ReadableStream === 'undefined' ||
        typeof TransformStream === 'undefined' ||
        typeof WritableStream === 'undefined') {
      this._addLog('warn', 'ReadableStream / TransformStream / WritableStream 不完整，无法演示管道');
      return;
    }
    this.setState({ pipeResult: '管道运行中...' });
    try {
      this._addLog('pipe', '【管道】source → uppercase TransformStream → WritableStream sink');
      const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
      let i = 0;
      const source = new ReadableStream({
        start: (controller) => {
          const timer = setInterval(() => {
            if (i >= words.length) { clearInterval(timer); try { controller.close(); } catch { /* noop */ } return; }
            try { controller.enqueue(words[i++]); } catch { /* noop */ }
          }, 120);
          if (this._timers) this._timers.add(timer);
        },
      });
      this._trackStream(source);
      // 自定义转换：转大写
      const upper = new TransformStream({
        transform(chunk, controller) { controller.enqueue(String(chunk).toUpperCase()); },
        flush(controller) { try { controller.enqueue('!'); } catch { /* noop */ } controller.close?.(); },
      });
      // sink：收集结果
      const sink = [];
      let totalBytes = 0;
      const writable = new WritableStream({
        write(chunk) {
          sink.push(chunk);
          try { totalBytes += new TextEncoder().encode(String(chunk)).byteLength; } catch { /* noop */ }
        },
        close() { /* sink 关闭 */ },
        abort(reason) { /* sink 异常 */ },
      });
      this._addLog('transform', 'TransformStream：transform => chunk.toUpperCase()，flush => enqueue("!")');
      this._addLog('pipe', '开始 pipeThrough(upper) ...');
      const transformed = source.pipeThrough(upper);
      this._addLog('pipe', '开始 pipeTo(writable sink) ...');
      await transformed.pipeTo(writable);
      const result = `[${sink.join(', ')}]`;
      this._addLog('pipe', `管道完成：${sink.length} 个 chunk / ${totalBytes}B，结果=${result}`);
      this.setState({ pipeResult: `完成：${sink.length} chunk / ${totalBytes}B，结果 ${result}` });
    } catch (err) {
      this._addLog('warn', '管道异常：' + (err && err.message));
      this.setState({ pipeResult: '异常：' + (err && err.message) });
    }
  }

  // tee 分流：一个流分叉为两个独立消费
  async _teeDemo() {
    if (typeof ReadableStream === 'undefined') {
      this._addLog('warn', 'ReadableStream 不可用，无法 tee');
      return;
    }
    this.setState({ pipeResult: 'tee 分流中...' });
    try {
      this._addLog('tee', '【tee】将一个流分叉为两个独立消费的流');
      const src = new ReadableStream({
        start(controller) {
          [1, 2, 3, 4, 5].forEach((n) => controller.enqueue(n));
          controller.close();
        },
      });
      this._trackStream(src);
      let branches;
      try { branches = src.tee(); } catch (err) {
        this._addLog('warn', 'tee() 调用失败：' + (err && err.message));
        this.setState({ pipeResult: 'tee 失败' });
        return;
      }
      const [a, b] = branches;
      this._trackStream(a);
      this._trackStream(b);
      const ra = a.getReader(), rb = b.getReader();
      this._trackReader(ra);
      this._trackReader(rb);
      const aOut = [], bOut = [];
      // 交替读取两个分支（实际场景可并行消费）
      while (true) {
        const r1 = await ra.read();
        if (r1.done) break;
        aOut.push(r1.value);
        const r2 = await rb.read();
        if (r2.done) break;
        bOut.push(r2.value);
        this._addLog('tee', `分支 A 读=${JSON.stringify(r1.value)}，分支 B 读=${JSON.stringify(r2.value)}`);
      }
      try { ra.releaseLock(); } catch { /* noop */ }
      try { rb.releaseLock(); } catch { /* noop */ }
      this._untrackReader(ra);
      this._untrackReader(rb);
      this._addLog('tee', `tee 完成：分支 A=[${aOut.join(', ')}]，分支 B=[${bOut.join(', ')}]`);
      this.setState({ pipeResult: `tee 完成：A=[${aOut.join(',')}] B=[${bOut.join(',')}]` });
    } catch (err) {
      this._addLog('warn', 'tee 异常：' + (err && err.message));
      this.setState({ pipeResult: 'tee 异常：' + (err && err.message) });
    }
  }

  _renderCard4() {
    const s = this.state;
    return this._card(
      'Card 4 · WritableStream + TransformStream + 管道',
      'new WritableStream({ start(controller), write(chunk, controller), close(), abort(reason) })；' +
      'writer.write(chunk)/close()/abort()/ready/closed/desiredSize；' +
      'new TransformStream({ transform(chunk, controller){ controller.enqueue(transformed); }, flush(controller) })；' +
      'readable.pipeTo(writable) / readable.pipeThrough(transformStream)；stream.tee() → [branch1, branch2] 分流。',
      h(Tag, { color: 'warning' }, 'Pipe'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('管道演示', {
            type: 'primary', size: 'sm', onClick: () => this._pipeDemo(),
          }),
          this._btn('tee 分流', {
            size: 'sm', onClick: () => this._teeDemo(),
          }),
        ),
        s.pipeResult
          ? h('div', { class: 'fs-sm fw-medium mt-md', style: { whiteSpace: 'pre-line' } }, s.pipeResult)
          : null,
        h('pre', { class: 'code-block mt-md' },
`const writable = new WritableStream({
  start(controller) {}, write(chunk, controller) {}, close() {}, abort(reason) {},
});
const writer = writable.getWriter();
writer.write(chunk); writer.close(); writer.abort();
writer.ready; writer.closed; writer.desiredSize;
const ts = new TransformStream({
  transform(chunk, controller) { controller.enqueue(transformed); },
  flush(controller) { /* 流结束 */ },
});
readable.pipeThrough(ts).pipeTo(writable);
const [branch1, branch2] = stream.tee(); // 分流`),
      ],
    );
  }

  // =================================================================
  // Card 5：流式 Fetch + 响应体流
  // =================================================================

  // 流式下载：response.body.getReader() 循环读取，实时显示进度
  // mock fetch 无 body，用 new Response(ReadableStream) 构造流式响应体
  async _streamDownload() {
    if (typeof fetch !== 'function') {
      this._addLog('warn', 'fetch 不可用，无法演示流式下载');
      return;
    }
    if (typeof Response === 'undefined' || typeof ReadableStream === 'undefined') {
      this._addLog('warn', 'Response / ReadableStream 不可用，无法演示流式响应体');
      return;
    }
    this.setState({ bodyProgress: '下载中...' });
    try {
      this._addLog('body', '【流式下载】调用 fetch 获取响应（mock 无 body，下面用 new Response(stream) 模拟流式响应体）');
      // 构造模拟流式响应：ReadableStream 入队多个 Uint8Array chunk
      const pieces = ['Hello, ', 'streaming ', 'world! ', 'This is ', 'a chunked ', 'response body.'];
      let idx = 0;
      const encoder = new TextEncoder();
      const bodyStream = new ReadableStream({
        start: (controller) => {
          const timer = setInterval(() => {
            if (idx >= pieces.length) { clearInterval(timer); try { controller.close(); } catch { /* noop */ } return; }
            try { controller.enqueue(encoder.encode(pieces[idx++])); } catch { /* noop */ }
          }, 120);
          if (this._timers) this._timers.add(timer);
        },
      });
      this._trackStream(bodyStream);
      const resp = new Response(bodyStream, { status: 200, statusText: 'OK', headers: { 'content-type': 'text/plain' } });
      this._addLog('body', `构造 Response：ok=${resp.ok}，status=${resp.status}，type=${resp.type}，body=${resp.body ? 'ReadableStream' : 'null'}`);
      if (!resp.body) {
        this._addLog('warn', 'resp.body 不可用（浏览器不支持流式响应体）');
        this.setState({ bodyProgress: 'resp.body 不可用' });
        return;
      }
      // const reader = response.body.getReader(); while(true){ const { value, done } = await reader.read(); if(done) break; ... }
      const reader = resp.body.getReader();
      this._trackReader(reader);
      const decoder = new TextDecoder();
      let received = 0, count = 0, text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const bytes = value && value.byteLength != null ? value.byteLength : 0;
        received += bytes; count++;
        try { text += decoder.decode(value); } catch { /* noop */ }
        this._addLog('download', `chunk#${count} ${bytes}B（累计 ${received}B）`);
        this.setState({ bodyProgress: `已接收 ${count} chunk / ${received}B` });
      }
      this._addLog('download', `流式下载完成：共 ${count} chunk / ${received}B，文本=${JSON.stringify(text)}`);
      this.setState({ bodyProgress: `完成：${count} chunk / ${received}B` });
      try { reader.releaseLock(); } catch { /* noop */ }
      this._untrackReader(reader);
    } catch (err) {
      this._addLog('warn', '流式下载异常：' + (err && err.message));
      this.setState({ bodyProgress: '异常：' + (err && err.message) });
    }
  }

  // TextDecoderStream 串接：response.body.pipeThrough(new TextDecoderStream())
  async _textDecoderStreamDemo() {
    if (typeof TextDecoderStream === 'undefined') {
      this._addLog('warn', 'TextDecoderStream 不可用，无法演示解码串接');
      return;
    }
    if (typeof ReadableStream === 'undefined' || typeof Response === 'undefined') {
      this._addLog('warn', 'ReadableStream / Response 不可用');
      return;
    }
    this.setState({ bodyProgress: 'TextDecoderStream 解码中...' });
    try {
      this._addLog('body', '【TextDecoderStream】构造字节流 → pipeThrough(new TextDecoderStream()) → 文本流');
      const encoder = new TextEncoder();
      const pieces = ['流式 ', '解码 ', '演示 ', '✓'];
      let i = 0;
      const byteStream = new ReadableStream({
        start: (controller) => {
          const timer = setInterval(() => {
            if (i >= pieces.length) { clearInterval(timer); try { controller.close(); } catch { /* noop */ } return; }
            try { controller.enqueue(encoder.encode(pieces[i++])); } catch { /* noop */ }
          }, 100);
          if (this._timers) this._timers.add(timer);
        },
      });
      this._trackStream(byteStream);
      // 模拟 response.body.pipeThrough(new TextDecoderStream())
      const resp = new Response(byteStream);
      const textStream = (resp.body || byteStream).pipeThrough(new TextDecoderStream());
      const reader = textStream.getReader();
      this._trackReader(reader);
      let count = 0, text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        count++; text += value;
        this._addLog('body', `TextDecoderStream chunk#${count}=${JSON.stringify(value)}`);
        this.setState({ bodyProgress: `已解码 ${count} chunk` });
      }
      this._addLog('download', `TextDecoderStream 完成：${count} chunk，拼接=${JSON.stringify(text)}`);
      this.setState({ bodyProgress: `解码完成：${count} chunk，文本=${JSON.stringify(text)}` });
      try { reader.releaseLock(); } catch { /* noop */ }
      this._untrackReader(reader);
    } catch (err) {
      this._addLog('warn', 'TextDecoderStream 演示异常：' + (err && err.message));
      this.setState({ bodyProgress: '异常：' + (err && err.message) });
    }
  }

  _renderCard5() {
    const s = this.state;
    return this._card(
      'Card 5 · 流式 Fetch + 响应体流',
      'response.body 是 ReadableStream；const reader = response.body.getReader(); while(true){ const { value, done } = await reader.read(); if(done) break; ... }；' +
      '流式下载大文件实时显示进度；TextDecoderStream 串接：response.body.pipeThrough(new TextDecoderStream())。',
      h(Tag, { color: s.bodyProgress.startsWith('完成') ? 'success' : (s.bodyProgress ? 'warning' : 'default') },
        s.bodyProgress || '空闲'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('开始流式下载', {
            type: 'primary', size: 'sm', onClick: () => this._streamDownload(),
          }),
          this._btn('TextDecoderStream 演示', {
            size: 'sm', onClick: () => this._textDecoderStreamDemo(),
          }),
        ),
        s.bodyProgress
          ? h('div', { class: 'fs-sm fw-medium mt-md', style: { whiteSpace: 'pre-line' } }, s.bodyProgress)
          : null,
        h('pre', { class: 'code-block mt-md' },
`// response.body 是 ReadableStream
const reader = response.body.getReader();
while (true) {
  const { value, done } = await reader.read();
  if (done) break; // value: Uint8Array chunk，实时累计可显示下载进度
}
// TextDecoderStream 串接：字节流 → 文本流
const textStream = response.body.pipeThrough(new TextDecoderStream());
const r = textStream.getReader();
const { value } = await r.read(); // value 已是解码后的字符串`),
      ],
    );
  }

  // =================================================================
  // Card 6：Headers 进阶 + Fetch 流式上传 + Response 静态方法
  // =================================================================

  _demoHeadersAdvanced() {
    const lines = [];
    try {
      const headers = new Headers();
      headers.append('Set-Cookie', 'session=abc; Path=/');
      headers.append('Set-Cookie', 'token=xyz; HttpOnly');
      headers.append('Content-Type', 'application/json');

      // getSetCookie() —— 唯一能正确获取多个 Set-Cookie 的方法
      const hasGetSetCookie = typeof headers.getSetCookie === 'function';
      if (hasGetSetCookie) {
        const cookies = headers.getSetCookie();
        lines.push(`Headers.getSetCookie() ✓ —— 返回数组（${cookies.length} 个 Set-Cookie）：`);
        cookies.forEach((c, i) => lines.push(`  [${i}] ${c}`));
      } else {
        lines.push('Headers.getSetCookie() ✗ 不可用（Chrome 113+/Firefox 127+）');
        lines.push('  传统 headers.get("Set-Cookie") 只返回第一个值，无法获取多个 Set-Cookie');
      }

      // get() vs getAll() vs getSetCookie() 对比
      lines.push('');
      lines.push(`headers.get("Set-Cookie") → "${headers.get('Set-Cookie')}"（仅第一个）`);
      if (typeof headers.getAll === 'function') {
        lines.push(`headers.getAll("Set-Cookie") → ${JSON.stringify(headers.getAll('Set-Cookie'))}（已废弃，仅旧浏览器）`);
      }
      lines.push('结论：处理 Set-Cookie 多值必须用 getSetCookie()');

      // Headers 迭代
      lines.push('');
      lines.push('Headers 迭代（entries/forEach/keys/values）：');
      const entries = [];
      headers.forEach((v, k) => entries.push(`  ${k}: ${v}`));
      lines.push(`forEach 遍历 ${entries.length} 项（注意 Set-Cookie 被合并为一条）：`);
      entries.forEach((e) => lines.push(e));

      this._addLog('headers', `Headers 进阶演示完成：getSetCookie=${hasGetSetCookie}`);
    } catch (err) {
      lines.push(`演示失败：${err.name} - ${err.message}`);
      this._addLog('error', `Headers 进阶演示失败：${err.message}`);
    }
    this.setState({ advancedHeadersState: lines.join('\n') });
  }

  _demoResponseStatic() {
    const lines = [];
    try {
      // Response.error() —— 构造网络错误响应
      const hasError = typeof Response.error === 'function';
      if (hasError) {
        const errResp = Response.error();
        lines.push(`Response.error() ✓ —— type=${errResp.type}, status=${errResp.status}, ok=${errResp.ok}`);
        lines.push('  用于 Service Worker 中构造网络错误响应（fetch 回退）');
      } else {
        lines.push('Response.error() ✗ 不可用');
      }

      // Response.json() —— 从 JSON 值构造 Response（Chrome 105+）
      const hasJson = typeof Response.json === 'function';
      if (hasJson) {
        const data = { user: 'alice', count: 42 };
        const jsonResp = Response.json(data, { status: 200, headers: { 'Content-Type': 'application/json' } });
        lines.push('');
        lines.push(`Response.json(data, init) ✓ —— status=${jsonResp.status}, ok=${jsonResp.ok}`);
        lines.push(`  Content-Type: ${jsonResp.headers.get('Content-Type')}`);
        lines.push('  用于 Service Worker 中直接返回 JSON 响应，无需手动序列化 + new Response(JSON.stringify(...))');
      } else {
        lines.push('Response.json() ✗ 不可用（Chrome 105+）');
        lines.push('  回退：new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } })');
      }

      // Response.redirect() —— 构造重定向响应
      const hasRedirect = typeof Response.redirect === 'function';
      if (hasRedirect) {
        const redirResp = Response.redirect('https://example.com', 302);
        lines.push('');
        lines.push(`Response.redirect(url, 302) ✓ —— status=${redirResp.status}, type=${redirResp.type}`);
        lines.push(`  Location: ${redirResp.headers.get('Location')}`);
      }

      this._addLog('response', `Response 静态方法演示完成：error=${hasError}, json=${hasJson}, redirect=${hasRedirect}`);
    } catch (err) {
      lines.push(`演示失败：${err.name} - ${err.message}`);
      this._addLog('error', `Response 静态方法演示失败：${err.message}`);
    }
    this.setState({ advancedHeadersState: lines.join('\n') });
  }

  _demoFetchDuplex() {
    const lines = [];
    try {
      // fetch duplex: 'half' —— 流式上传请求体
      // 检测方式：尝试构造 Request 带 duplex
      let duplexSupported = false;
      try {
        const req = new Request('https://example.com', {
          method: 'POST',
          body: new ReadableStream({
            start(c) { c.enqueue(new TextEncoder().encode('chunk1\n')); c.close(); },
          }),
          duplex: 'half',
        });
        duplexSupported = req.duplex === 'half';
      } catch (e) {
        duplexSupported = false;
      }

      if (duplexSupported) {
        lines.push("fetch duplex: 'half' ✓ —— 流式上传请求体可用");
        lines.push('');
        lines.push('流式上传模式：');
        lines.push('  const stream = new ReadableStream({ ... });');
        lines.push("  await fetch(url, { method: 'POST', body: stream, duplex: 'half' });");
        lines.push('');
        lines.push('用途：上传大文件/实时数据流，无需在内存中缓冲完整请求体');
        lines.push('限制：duplex 必须为 "half"（仅请求体流式，响应体仍需等待）');
      } else {
        lines.push("fetch duplex: 'half' ✗ 不可用（Chrome 105+ 且需启用实验特性）");
        lines.push('');
        lines.push('流式上传请求体的唯一标准方式：');
        lines.push('  const stream = new ReadableStream({ ... });');
        lines.push("  await fetch(url, { method: 'POST', body: stream, duplex: 'half' });");
        lines.push('');
        lines.push('vs 传统方式：body 只能是 Blob/BufferSource/FormData/URLSearchParams/String（一次性缓冲）');
        lines.push('duplex: "half" 允许请求体为 ReadableStream，实现流式上传');
      }

      this._addLog('duplex', `fetch duplex 演示完成：supported=${duplexSupported}`);
    } catch (err) {
      lines.push(`演示失败：${err.name} - ${err.message}`);
      this._addLog('error', `fetch duplex 演示失败：${err.message}`);
    }
    this.setState({ advancedHeadersState: lines.join('\n') });
  }

  _renderCard6() {
    const s = this.state;
    const hasHeaders = typeof Headers !== 'undefined';
    return this._card(
      'Card 6 · Headers 进阶 + Fetch 流式上传 + Response 静态方法',
      'Headers.getSetCookie() 处理多个 Set-Cookie（vs get/getAll）+ fetch duplex:"half" 流式上传请求体 + Response.error()/json()/redirect() 静态方法。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: hasHeaders ? 'success' : 'error' }, hasHeaders ? 'Headers ✓' : '不可用'),
      ),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('Headers.getSetCookie', { type: 'primary', size: 'sm', disabled: !hasHeaders, onClick: () => this._demoHeadersAdvanced() }),
          this._btn('Response 静态方法', { type: 'primary', size: 'sm', disabled: !hasHeaders, onClick: () => this._demoResponseStatic() }),
          this._btn('fetch duplex:half', { type: 'primary', size: 'sm', onClick: () => this._demoFetchDuplex() }),
        ),
        s.advancedHeadersState
          ? h('pre', { class: 'code-block mt-md', style: { maxHeight: '300px', overflow: 'auto' } }, s.advancedHeadersState)
          : null,
        h('pre', { class: 'code-block mt-md' },
`// 1. Headers.getSetCookie() —— 多 Set-Cookie 处理
const h = new Headers();
h.append('Set-Cookie', 'a=1; Path=/');
h.append('Set-Cookie', 'b=2; HttpOnly');
h.getSetCookie();  // ['a=1; Path=/', 'b=2; HttpOnly']  ✓
h.get('Set-Cookie'); // 'a=1; Path=/'  ✗ 仅第一个

// 2. fetch 流式上传
const stream = new ReadableStream({ start(c) { c.enqueue(data); c.close(); } });
await fetch(url, { method: 'POST', body: stream, duplex: 'half' });

// 3. Response 静态方法（Service Worker 常用）
Response.error();           // 网络错误响应（type=error, status=0）
Response.json({ ok: true }); // JSON 响应（Chrome 105+）
Response.redirect(url, 302); // 重定向响应`),
      ],
    );
  }

  // =================================================================
  // 整页渲染
  // =================================================================
  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, '流与 Fetch 深度实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'Streams API 是浏览器处理流式数据的基础设施，Fetch API 借助 ReadableStream 实现真正的流式响应。' +
        '本页演示流式 fetch、管道组合、AbortController 取消、字节流。'),
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
