// =====================================================================
// AdvancedNetworkPage.js —— 高级网络 API 实验室
// 演示：1.WebTransport（QUIC/HTTP3：ready/closed/close/datagrams/
//   createBidirectionalStream/createUnidirectionalStream/incoming*/stats）
//   2.URLPattern（exec/test/groups） 3.Compression Streams（pipeThrough）
//   4.EventSource（SSE：onopen/onmessage/onerror/close）
//   5.structuredClone（深拷贝/循环引用/transfer）
// 说明：URLPattern/CompressionStream/DecompressionStream/structuredClone 在 Node 18+
//   真实可用；WebTransport/EventSource 在 jsdom/Node 通常不可用，仅做能力检测与日志。
//   所有 API 调用前做 typeof 检测，不可用时仅 _addLog('warn', ...)，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// WebTransport / EventSource 演示用的 mock URL（本地无真实服务器，会 reject/重连）
const WT_MOCK_URL = 'https://127.0.0.1:4433/echo';
const SSE_MOCK_URL = 'http://127.0.0.1:8787/events';

export class AdvancedNetworkPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      wtConnInfo: '',        // Card 1：WebTransport 连接
      wtStreamInfo: '',      // Card 2：WebTransport 流
      urlPatternInfo: '',    // Card 3：URLPattern
      compressionInfo: '',   // Card 4：CompressionStream
      eventSourceInfo: '',   // Card 5：EventSource
      cloneInfo: '',         // Card 6：structuredClone
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._transport = null;            // Card 1/2 WebTransport 实例
    this._wtBidiReader = null;         // Card 2 双向流 readable 的 reader
    this._wtIncomingBidiReader = null; // Card 2 incomingBidirectionalStreams 的 reader
    this._wtIncomingUniReader = null;  // Card 2 incomingUnidirectionalStreams 的 reader
    this._eventSource = null;          // Card 5 EventSource 实例
    this._compressionStream = null;    // Card 4 CompressionStream 引用

    // 一次性能力检测：高级网络 API 全家桶
    const hasWebTransport = typeof WebTransport !== 'undefined';
    const hasURLPattern = typeof URLPattern !== 'undefined';
    const hasCompression = typeof CompressionStream !== 'undefined';
    const hasDecompression = typeof DecompressionStream !== 'undefined';
    const hasEventSource = typeof EventSource !== 'undefined';
    const hasStructuredClone = typeof structuredClone === 'function';

    const parts = [
      `WebTransport ${hasWebTransport ? '✓' : '✗'}`, `URLPattern ${hasURLPattern ? '✓' : '✗'}`, `CompressionStream ${hasCompression ? '✓' : '✗'}`,
      `DecompressionStream ${hasDecompression ? '✓' : '✗'}`, `EventSource ${hasEventSource ? '✓' : '✗'}`, `structuredClone ${hasStructuredClone ? '✓' : '✗'}`,
    ];
    const okCount = [hasWebTransport, hasURLPattern, hasCompression, hasDecompression, hasEventSource, hasStructuredClone].filter(Boolean).length;
    const summary =
      `高级网络 API 能力检测：${parts.join(' · ')}。\n当前环境（jsdom/Node）共 ${okCount}/6 项可用：` +
      `URLPattern / CompressionStream / DecompressionStream / structuredClone 通常在 Node 18+ 真实可用，可完整演示；` +
      `WebTransport 仅 Chrome 等浏览器实现（基于 QUIC/HTTP3），EventSource 在 jsdom 中可能不可用，` +
      `不可用时按钮仍可点击但仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog('info', `能力检测：${parts.join('，')}`);
    if (!hasWebTransport) this._addLog('warn', 'WebTransport 不可用（需 Chrome 等浏览器，基于 QUIC/HTTP3）');
    if (!hasURLPattern) this._addLog('warn', 'URLPattern 不可用（需 Node 18+ 或较新 Chrome）');
    if (!hasCompression) this._addLog('warn', 'CompressionStream 不可用（需 Node 18+ 或较新浏览器）');
    if (!hasDecompression) this._addLog('warn', 'DecompressionStream 不可用（需 Node 18+ 或较新浏览器）');
    if (!hasEventSource) this._addLog('warn', 'EventSource 不可用（jsdom 可能未实现，需真实浏览器）');
    if (!hasStructuredClone) this._addLog('warn', 'structuredClone 不可用（需 Node 17+ 或较新浏览器）');
  }

  componentWillUnmount() {
    // 释放 WebTransport：调用 close 关闭 QUIC 连接
    if (this._transport) {
      try { this._transport.close?.({ closeCode: 0, reason: '页面卸载' }); } catch { /* noop */ }
      this._transport = null;
    }
    // 释放 reader：cancel 取消流读取
    [this._wtBidiReader, this._wtIncomingBidiReader, this._wtIncomingUniReader].forEach((r) => {
      if (r) { try { r.cancel?.('页面卸载'); } catch { /* noop */ } }
    });
    this._wtBidiReader = this._wtIncomingBidiReader = this._wtIncomingUniReader = null;
    // 释放 EventSource：close 关闭 SSE 连接
    if (this._eventSource) {
      try { this._eventSource.close?.(); } catch { /* noop */ }
      this._eventSource = null;
    }
    // CompressionStream 是 TransformStream，置空引用让 GC 回收
    this._compressionStream = null;
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
      webtransport: typeof WebTransport !== 'undefined',
      urlpattern: typeof URLPattern !== 'undefined',
      compression: typeof CompressionStream !== 'undefined',
      decompression: typeof DecompressionStream !== 'undefined',
      eventsource: typeof EventSource !== 'undefined',
      structuredClone: typeof structuredClone === 'function',
    };
  }

  // =================== Card 1：WebTransport 连接 ===================

  // new WebTransport(url) —— url 形如 https://... 或 quic-transport://...
  // transport.ready → Promise（连接就绪）；transport.closed → Promise（连接关闭）
  // transport.close({ closeCode, reason })；transport.datagrams.maxDatagramSize
  async _openTransport() {
    if (!this._caps().webtransport) {
      this._addLog('warn', 'WebTransport 不可用（仅 Chrome 等浏览器实现，基于 QUIC/HTTP3）');
      this.setState({ wtConnInfo: 'WebTransport 不可用：typeof WebTransport === "undefined"\n测试环境不支持，请用真实浏览器（Chrome）打开本页以完整演示 QUIC 连接。' });
      return;
    }
    try {
      this._addLog('info', `new WebTransport('${WT_MOCK_URL}') —— 尝试建立 QUIC/HTTP3 连接…`);
      const transport = new WebTransport(WT_MOCK_URL);
      this._transport = transport;
      const dg = transport.datagrams;                       // datagrams 属性（数据报通道）
      const maxDg = dg?.maxDatagramSize;
      const inAge = dg?.incomingMaxAge;
      const outAge = dg?.outgoingMaxAge;
      // 等待 ready Promise（无真实 QUIC 服务器时会 reject）
      let readyLine;
      try {
        await transport.ready;
        readyLine = 'transport.ready ✓（连接已就绪，可创建流与收发数据报）';
        this._addLog('open', 'transport.ready resolve（QUIC 连接就绪）');
      } catch (err) {
        readyLine = `transport.ready reject：${err.name} - ${err.message}\n  （本地无真实 QUIC 服务器，请用真实浏览器 + QUIC 服务器演示完整流程）`;
        this._addLog('warn', `transport.ready reject：${err.message}（无真实 QUIC 服务器）`);
      }
      this.setState({
        wtConnInfo:
          `new WebTransport('${WT_MOCK_URL}') → WebTransport 对象 ✓\n` + `transport.datagrams.maxDatagramSize = ${maxDg ?? '(未定义)'}（单数据报最大字节数）\n` + `  incomingMaxAge = ${inAge ?? '(未定义)'}，outgoingMaxAge = ${outAge ?? '(未定义)'}\n` +
          `transport.closed → Promise（连接关闭时 resolve/reject，本演示不 await 以免阻塞）\n` +
          readyLine,
      });
    } catch (err) {
      this._addLog('warn', `创建 WebTransport 失败：${err.name} - ${err.message}`);
      this.setState({ wtConnInfo: `创建 WebTransport 失败：${err.name} - ${err.message}` });
    }
  }

  // transport.close({ closeCode, reason }) —— 主动关闭连接，触发 closed Promise
  async _closeTransport() {
    if (!this._caps().webtransport) { this._addLog('warn', 'WebTransport 不可用'); return; }
    if (!this._transport) { this._addLog('warn', '请先点击「建立连接」'); return; }
    try {
      this._transport.close({ closeCode: 0, reason: '用户主动关闭' });
      this._addLog('close', 'transport.close({ closeCode: 0, reason: "用户主动关闭" }) 已调用');
      this.setState({
        wtConnInfo:
          `transport.close({ closeCode: 0, reason: "用户主动关闭" }) 已调用 ✓\n` +
          `说明：close 后 transport.closed Promise 将 resolve（携带 closeCode/reason）；所有未完成的流与数据报读写将被中止。`,
      });
      this._transport = null;
    } catch (err) {
      this._addLog('warn', `close 失败：${err.name} - ${err.message}`);
    }
  }

  // transport.stats → Promise<WebTransportStats>（bytesSent/bytesReceived/numOutgoingStreams 等）
  async _readStats() {
    if (!this._caps().webtransport) { this._addLog('warn', 'WebTransport 不可用'); return; }
    if (!this._transport) { this._addLog('warn', '请先点击「建立连接」'); return; }
    try {
      const stats = await this._transport.stats;
      this.setState({ wtConnInfo: `transport.stats → WebTransportStats：\n${JSON.stringify(stats, null, 2)}` });
      this._addLog('stats', `读取 stats：${JSON.stringify(stats)}`);
    } catch (err) {
      this._addLog('warn', `读取 stats 失败：${err.name} - ${err.message}（可能连接已关闭或未就绪）`);
      this.setState({ wtConnInfo: `读取 stats 失败：${err.name} - ${err.message}\n（连接未就绪或已关闭，stats 需在连接活跃时读取）` });
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. WebTransport 连接（QUIC/HTTP3）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.webtransport ? 'success' : 'error' }, caps.webtransport ? 'WebTransport ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'ready / closed / close'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new WebTransport(url) 创建基于 QUIC/HTTP3 的低延迟双向通信会话；url 形如 https://example.com 或 quic-transport://...；transport.ready 是 Promise（连接就绪时 resolve）；transport.closed 是 Promise（连接关闭时 resolve/reject）；transport.close({ closeCode, reason }) 主动关闭；transport.datagrams.maxDatagramSize 为单数据报最大字节数；transport.stats 返回统计（bytesSent/bytesReceived/numOutgoingStreams 等）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('建立连接', { type: 'primary', size: 'sm', disabled: !caps.webtransport, onClick: () => this._openTransport() }),
          this._btn('读取 stats', { size: 'sm', disabled: !caps.webtransport, onClick: () => this._readStats() }),
          this._btn('关闭连接', { danger: true, size: 'sm', disabled: !caps.webtransport, onClick: () => this._closeTransport() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '连接状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.wtConnInfo || '（点击「建立连接」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } },
          h('code', {},
`const transport = new WebTransport('https://example.com/echo');
await transport.ready;                          // 等待连接就绪
const maxDg = transport.datagrams.maxDatagramSize;
const stats = await transport.stats;            // { bytesSent, bytesReceived, ... }
transport.close({ closeCode: 0, reason: '' });  // 主动关闭
await transport.closed;                          // 等待连接完全关闭`)),
        h(Alert, {
          type: 'info',
          message: 'WebTransport = QUIC/HTTP3 上的多路复用双向通信',
          description: '相比 WebSocket（TCP+单流），WebTransport 基于 QUIC：多流并行、0-RTT 握手、无队头阻塞；支持可靠流与不可靠数据报。需 https + QUIC 服务器，目前仅 Chrome 等浏览器实现。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：WebTransport 流 ===================

  // transport.createBidirectionalStream() → Promise<WebTransportBidirectionalStream>
  //   stream.readable（ReadableStream） / stream.writable（WritableStream）
  async _createBidiStream() {
    if (!this._caps().webtransport) {
      this._addLog('warn', 'WebTransport 不可用');
      this.setState({ wtStreamInfo: 'WebTransport 不可用，请用真实浏览器演示双向流。' });
      return;
    }
    if (!this._transport) { this._addLog('warn', '请先在 Card 1「建立连接」'); return; }
    try {
      this._addLog('info', 'transport.createBidirectionalStream() —— 创建双向流…');
      const stream = await this._transport.createBidirectionalStream();
      this._wtBidiStream = stream;
      // 通过 writable.getWriter().write() 发送数据
      const writer = stream.writable.getWriter();
      await writer.write(new TextEncoder().encode('hello from bidi stream'));
      this._addLog('write', 'bidi stream：writable.getWriter().write(Uint8Array("hello...")) 已发送');
      // 读取对端响应（无真实服务器时 read 会 hang，这里只取 reader 不 await read）
      this._wtBidiReader = stream.readable.getReader();
      this.setState({
        wtStreamInfo:
          `transport.createBidirectionalStream() → WebTransportBidirectionalStream ✓\n` + `stream.writable → WritableStream（getWriter().write() 发送数据）\n` + `stream.readable → ReadableStream（getReader().read() 接收对端响应）\n` +
          `已通过 writable.getWriter().write(Uint8Array("hello from bidi stream")) 发送 ✓\n` + `已获取 readable.getReader() 等待对端响应（无真实服务器时 read 会 hang）`,
      });
      writer.releaseLock?.();
    } catch (err) {
      this._addLog('warn', `创建双向流失败：${err.name} - ${err.message}`);
      this.setState({ wtStreamInfo: `创建双向流失败：${err.name} - ${err.message}\n（连接未就绪或对端不可达，需真实 QUIC 服务器）` });
    }
  }

  // transport.createUnidirectionalStream() → Promise<WritableStream>（只能写）
  async _createUniStream() {
    if (!this._caps().webtransport) { this._addLog('warn', 'WebTransport 不可用'); return; }
    if (!this._transport) { this._addLog('warn', '请先在 Card 1「建立连接」'); return; }
    try {
      this._addLog('info', 'transport.createUnidirectionalStream() —— 创建单向流（仅写）…');
      const writable = await this._transport.createUnidirectionalStream();
      const writer = writable.getWriter();
      await writer.write(new TextEncoder().encode('one-way message'));
      await writer.close();
      this._addLog('write', 'uni stream：write("one-way message") + close() 已完成');
      this.setState({
        wtStreamInfo:
          `transport.createUnidirectionalStream() → WritableStream ✓（仅可写）\n` + `writer.write(Uint8Array("one-way message")) → 发送\n` + `writer.close() → 关闭单向流\n说明：单向流只能向对端发送，无法读取响应；适合日志上报等场景。`,
      });
    } catch (err) {
      this._addLog('warn', `创建单向流失败：${err.name} - ${err.message}`);
      this.setState({ wtStreamInfo: `创建单向流失败：${err.name} - ${err.message}\n（连接未就绪或对端不可达，需真实 QUIC 服务器）` });
    }
  }

  // transport.incomingBidirectionalStreams / incomingUnidirectionalStreams
  //   是 ReadableStream，异步迭代接收对端发起的流
  async _receiveIncomingStreams() {
    if (!this._caps().webtransport) { this._addLog('warn', 'WebTransport 不可用'); return; }
    if (!this._transport) { this._addLog('warn', '请先在 Card 1「建立连接」'); return; }
    try {
      const inBidi = this._transport.incomingBidirectionalStreams;
      const inUni = this._transport.incomingUnidirectionalStreams;
      const hasBidi = !!inBidi;
      const hasUni = !!inUni;
      // 取 reader 但不 await read（无对端发起时会 hang）
      if (hasBidi) this._wtIncomingBidiReader = inBidi.getReader();
      if (hasUni) this._wtIncomingUniReader = inUni.getReader();
      this._addLog('info', `incoming streams：bidirectional=${hasBidi}，unidirectional=${hasUni}（已取 reader 等待对端发起）`);
      this.setState({
        wtStreamInfo:
          `transport.incomingBidirectionalStreams → ReadableStream<WebTransportBidirectionalStream>（${hasBidi ? '✓' : '✗'}）\n` + `transport.incomingUnidirectionalStreams → ReadableStream<ReadableStream>（${hasUni ? '✓' : '✗'}）\n` +
          `已 getReader() 等待对端发起的流（无对端发起时 read 会 hang）\n` + `说明：incoming 是异步队列，对端每发起一个流，reader.read() 就返回一个流对象。`,
      });
    } catch (err) {
      this._addLog('warn', `接收 incoming streams 失败：${err.name} - ${err.message}`);
      this.setState({ wtStreamInfo: `接收 incoming streams 失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. WebTransport 流（双向 / 单向 / incoming）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.webtransport ? 'success' : 'error' }, caps.webtransport ? 'Streams ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'createBidi / createUni'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'transport.createBidirectionalStream() → Promise<WebTransportBidirectionalStream>，含 .readable（接收）与 .writable（发送）；transport.createUnidirectionalStream() → Promise<WritableStream>（仅可写）；transport.incomingBidirectionalStreams / incomingUnidirectionalStreams 是 ReadableStream，异步接收对端发起的流。流是可靠、有序的（与 datagrams 的不可靠无序相对）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建双向流', { type: 'primary', size: 'sm', disabled: !caps.webtransport, onClick: () => this._createBidiStream() }),
          this._btn('创建单向流', { type: 'primary', size: 'sm', disabled: !caps.webtransport, onClick: () => this._createUniStream() }),
          this._btn('接收 incoming', { size: 'sm', disabled: !caps.webtransport, onClick: () => this._receiveIncomingStreams() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '流操作结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } },
          h('code', {}, s.wtStreamInfo || '（点击「创建双向流」/「创建单向流」/「接收 incoming」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`// 双向流：可读可写
const bidi = await transport.createBidirectionalStream();
await bidi.writable.getWriter().write(new TextEncoder().encode('ping'));
const { value } = await bidi.readable.getReader().read();
// 单向流：仅写
const w = await transport.createUnidirectionalStream();
await w.getWriter().write(new TextEncoder().encode('one-way'));
// 接收对端发起的流
const { value: peerBidi } = await transport.incomingBidirectionalStreams.getReader().read();`)),
        h(Alert, {
          type: 'warning',
          message: '流是可靠有序的，datagrams 是不可靠无序的',
          description: 'WebTransport 提供两种传输语义：流（stream）保证可靠有序，适合文件传输、RPC；数据报（datagram）不保证可靠与顺序，但延迟更低，适合游戏帧、心跳。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：URLPattern ===================

  // new URLPattern(input) / new URLPattern(pattern, baseURL)
  // pattern.exec(input) → URLPatternResult | null；pattern.test(input) → boolean
  _constructPatterns() {
    if (!this._caps().urlpattern) {
      this._addLog('warn', 'URLPattern 不可用（需 Node 18+ 或较新 Chrome）');
      this.setState({ urlPatternInfo: 'URLPattern 不可用：typeof URLPattern === "undefined"\n测试环境不支持，请用 Node 18+ 或较新 Chrome 打开。' });
      return;
    }
    try {
      // 构造多种 pattern：:param / * wildcard / (group) 正则组 / 可选组
      new URLPattern({ pathname: '/users/:id' });
      new URLPattern('https://example.com/:id(\\d+)');
      new URLPattern({ pathname: '/files/*' });
      new URLPattern({ pathname: '/articles/:year/:month/:slug' });
      new URLPattern({ pathname: '/search{:q}?' });
      this._addLog('pattern', `构造 5 个 URLPattern：/users/:id、/:id(\\d+)、/files/*、/articles/:year/:month/:slug、/search{:q}?`);
      this.setState({
        urlPatternInfo:
          `new URLPattern({ pathname: '/users/:id' }) → 命名参数 :id\n` + `new URLPattern('https://example.com/:id(\\\\d+)') → 正则组 (\\\\d+) 限定数字\n` + `new URLPattern({ pathname: '/files/*' }) → 通配符 * 匹配任意路径段\n` + `new URLPattern({ pathname: '/articles/:year/:month/:slug' }) → 多段命名参数\n` +
          `new URLPattern({ pathname: '/search{:q}?' }) → 可选组 {:q}?\n\n` + `说明：pattern 可指定 protocol/username/password/hostname/port/pathname/search/hash 任意子集；\n:param 命名捕获，* 通配，(regex) 限定，{x}? 可选，{\\/path} 转义前缀。`,
      });
    } catch (err) {
      this._addLog('warn', `构造 pattern 失败：${err.name} - ${err.message}`);
      this.setState({ urlPatternInfo: `构造 pattern 失败：${err.name} - ${err.message}` });
    }
  }

  // pattern.exec(input) → URLPatternResult | null（含 groups）
  _execPattern() {
    if (!this._caps().urlpattern) { this._addLog('warn', 'URLPattern 不可用'); return; }
    try {
      // 1) 命名参数 2) 正则组 3) 通配符 4) 多段参数
      const p1 = new URLPattern({ pathname: '/users/:id' });
      const r1 = p1.exec('https://api.example.com/users/42');
      const p2 = new URLPattern('https://example.com/:id(\\d+)');
      const r2 = p2.exec('https://example.com/1024');
      const r2bad = p2.exec('https://example.com/abc');
      const p3 = new URLPattern({ pathname: '/files/*' });
      const r3 = p3.exec('https://example.com/files/a/b/c.txt');
      const p4 = new URLPattern({ pathname: '/articles/:year/:month/:slug' });
      const r4 = p4.exec('https://example.com/articles/2026/07/hello');
      this._addLog('exec', `exec 5 组 pattern：id=42, id=1024(数字), files/*, articles 三段, 不匹配=null`);
      this.setState({
        urlPatternInfo:
          `exec('/users/:id') 对 '.../users/42'：\n` + `  pathname.groups = ${JSON.stringify(r1?.pathname?.groups)}（{ id: '42' }）\n  hostname.groups = ${JSON.stringify(r1?.hostname?.groups)}\n\n` + `exec('https://example.com/:id(\\\\d+)') 对 '.../1024'：\n  groups = ${JSON.stringify(r2?.pathname?.groups)}（{ id: '1024' }）\n` +
          `  对 '.../abc' → ${r2bad === null ? 'null（非数字不匹配）' : '匹配'}\n\n` + `exec('/files/*') 对 '.../files/a/b/c.txt'：\n  pathname.groups = ${JSON.stringify(r3?.pathname?.groups)}（{ '0': 'a/b/c.txt' }）\n\n` +
          `exec('/articles/:year/:month/:slug') 对 '.../articles/2026/07/hello'：\n  groups = ${JSON.stringify(r4?.pathname?.groups)}（{ year:'2026', month:'07', slug:'hello' }）\n\n` + `URLPatternResult 结构：protocol/username/password/hostname/port/pathname/search/hash，每个含 { input, groups }；exec 不匹配返回 null。`,
      });
    } catch (err) {
      this._addLog('warn', `exec 失败：${err.name} - ${err.message}`);
      this.setState({ urlPatternInfo: `exec 失败：${err.name} - ${err.message}` });
    }
  }

  // pattern.test(input) → boolean（仅判断是否匹配，不返回 groups）
  _testPattern() {
    if (!this._caps().urlpattern) { this._addLog('warn', 'URLPattern 不可用'); return; }
    try {
      const p = new URLPattern({ pathname: '/api/:version/:resource' });
      const t1 = p.test('https://example.com/api/v1/users');
      const t2 = p.test('https://example.com/api/v1');
      const t3 = p.test('https://example.com/web/v1/users');
      const t4 = p.test({ pathname: '/api/v2/posts' }); // 也可传 pattern 对象
      this._addLog('test', `test：/api/v1/users=${t1}，/api/v1=${t2}，/web/v1/users=${t3}，{pathname:/api/v2/posts}=${t4}`);
      this.setState({
        urlPatternInfo:
          `pattern = new URLPattern({ pathname: '/api/:version/:resource' })\n` + `test('https://example.com/api/v1/users') = ${t1}（匹配）\n` + `test('https://example.com/api/v1') = ${t2}（缺 :resource 段，不匹配）\n` + `test('https://example.com/web/v1/users') = ${t3}（pathname 不匹配）\n` +
          `test({ pathname: '/api/v2/posts' }) = ${t4}（也可传 pattern 对象）\n\n` + `说明：test 返回 boolean，比 exec 更轻量；exec 返回完整 result（含 groups）。`,
      });
    } catch (err) {
      this._addLog('warn', `test 失败：${err.name} - ${err.message}`);
      this.setState({ urlPatternInfo: `test 失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. URLPattern API',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.urlpattern ? 'success' : 'error' }, caps.urlpattern ? 'URLPattern ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'exec / test'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new URLPattern(input) / new URLPattern(pattern, baseURL) 构造匹配模式；pattern 可指定 protocol/username/password/hostname/port/pathname/search/hash 任意子集；支持 :param 命名捕获、* 通配、(regex) 正则组、{x}? 可选、{/path} 转义前缀。pattern.exec(input) → URLPatternResult | null（含 groups）；pattern.test(input) → boolean。典型用于客户端路由与 Service Worker 路由匹配。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('构造 patterns', { type: 'primary', size: 'sm', disabled: !caps.urlpattern, onClick: () => this._constructPatterns() }),
          this._btn('exec 解析', { type: 'primary', size: 'sm', disabled: !caps.urlpattern, onClick: () => this._execPattern() }),
          this._btn('test 匹配', { size: 'sm', disabled: !caps.urlpattern, onClick: () => this._testPattern() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'URLPattern 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.urlPatternInfo || '（点击「构造 patterns」/「exec 解析」/「test 匹配」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } },
          h('code', {},
`const p = new URLPattern({ pathname: '/users/:id(\\\\d+)' });
const r = p.exec('https://api.example.com/users/42');
if (r) console.log(r.pathname.groups.id); // '42'
const ok = p.test('https://api.example.com/users/abc'); // false
// Service Worker 路由
self.addEventListener('fetch', (e) => {
  if (p.test(e.request.url)) { /* 命中路由 */ }
});`)),
        h(Alert, {
          type: 'info',
          message: 'URLPattern 是路由匹配的标准化方案',
          description: '相比手写正则或 path-to-regexp，URLPattern 平台内置、统一支持 protocol/hostname/pathname 等多维匹配，exec 返回结构化 groups。Node 18+ 与较新 Chrome 全局可用。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：CompressionStream ===================

  // new CompressionStream(format) → TransformStream（readable / writable）
  // format: 'gzip' | 'deflate' | 'deflate-raw'
  // 用法：inputStream.pipeThrough(new CompressionStream('gzip')).pipeTo(outputStream)
  async _compressString() {
    if (!this._caps().compression) {
      this._addLog('warn', 'CompressionStream 不可用（需 Node 18+ 或较新浏览器）');
      this.setState({ compressionInfo: 'CompressionStream 不可用：typeof CompressionStream === "undefined"\n测试环境不支持，请用 Node 18+ 或较新浏览器打开。' });
      return;
    }
    try {
      const original = 'WebTransport 基于 QUIC/HTTP3 提供低延迟双向通信，'.repeat(50);
      const inputBytes = new TextEncoder().encode(original);
      const formats = ['gzip', 'deflate', 'deflate-raw'];
      const results = [];
      for (const fmt of formats) {
        const cs = new CompressionStream(fmt);
        this._compressionStream = cs;
        const writer = cs.writable.getWriter();          // 用 new Response(stream.readable).arrayBuffer() 收集输出
        const promise = new Response(cs.readable).arrayBuffer();
        await writer.write(inputBytes);
        await writer.close();
        const compressed = new Uint8Array(await promise);
        const ratio = ((compressed.length / inputBytes.length) * 100).toFixed(1);
        results.push(`${fmt}：${inputBytes.length}B → ${compressed.length}B（${ratio}%）`);
        this._addLog('compress', `${fmt} 压缩：${inputBytes.length}B → ${compressed.length}B（${ratio}%）`);
      }
      this.setState({
        compressionInfo:
          `new CompressionStream(format) → TransformStream（format ∈ 'gzip' | 'deflate' | 'deflate-raw'）\n` + `原始文本：'WebTransport 基于 QUIC/HTTP3...'.repeat(50)，UTF-8 编码 = ${inputBytes.length} 字节\n\n` + `压缩结果：\n• ${results.join('\n• ')}\n\n` +
          `流程：writer.write(inputBytes) → writer.close() → new Response(cs.readable).arrayBuffer()\n` + `说明：CompressionStream 是 TransformStream，可 pipeThrough 串联；gzip 带 CRC32+大小校验，deflate 是 zlib 格式，deflate-raw 是原始 deflate。`,
      });
    } catch (err) {
      this._addLog('warn', `压缩失败：${err.name} - ${err.message}`);
      this.setState({ compressionInfo: `压缩失败：${err.name} - ${err.message}` });
    }
  }

  // new DecompressionStream(format) → TransformStream，配合 fetch response.body 解压
  async _decompressString() {
    if (!this._caps().compression || !this._caps().decompression) {
      this._addLog('warn', 'CompressionStream / DecompressionStream 不可用');
      this.setState({ compressionInfo: 'CompressionStream 或 DecompressionStream 不可用，请用 Node 18+ 或较新浏览器打开。' });
      return;
    }
    try {
      const original = 'Compression Streams API 支持流式压缩与解压。'.repeat(30);
      const inputBytes = new TextEncoder().encode(original);
      // 1) gzip 压缩
      const cs = new CompressionStream('gzip');
      const cWriter = cs.writable.getWriter();
      const cPromise = new Response(cs.readable).arrayBuffer();
      await cWriter.write(inputBytes);
      await cWriter.close();
      const compressed = new Uint8Array(await cPromise);
      // 2) gzip 解压（DecompressionStream）
      const ds = new DecompressionStream('gzip');
      const dWriter = ds.writable.getWriter();
      const dPromise = new Response(ds.readable).arrayBuffer();
      await dWriter.write(compressed);
      await dWriter.close();
      const decompressed = new Uint8Array(await dPromise);
      const ok = new TextDecoder().decode(decompressed) === original;
      this._addLog('decompress', `gzip 压缩 ${inputBytes.length}B → ${compressed.length}B → 解压 ${decompressed.length}B，round-trip ${ok ? '✓' : '✗'}`);
      this.setState({
        compressionInfo:
          `new DecompressionStream('gzip') → TransformStream（与 CompressionStream 对称）\n` + `原始：${inputBytes.length} 字节 → gzip 压缩 ${compressed.length} 字节 → 解压 ${decompressed.length} 字节\n` + `解压后解码 === 原文：${ok ? '✓ 一致' : '✗ 不一致'}\n\n` +
          `流程：compress = new CompressionStream('gzip') → write → close → arrayBuffer\n` + `      decompress = new DecompressionStream('gzip') → write(compressed) → close → arrayBuffer\n` + `配合 fetch：response.body.pipeThrough(new DecompressionStream('gzip')) 解压服务端 gzip 响应。`,
      });
    } catch (err) {
      this._addLog('warn', `解压失败：${err.name} - ${err.message}`);
      this.setState({ compressionInfo: `解压失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. CompressionStream / DecompressionStream',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.compression ? 'success' : 'error' }, caps.compression ? 'Compression ✓' : '不可用'),
        h(Tag, { color: caps.decompression ? 'success' : 'error' }, caps.decompression ? 'Decompression ✓' : '不可用'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new CompressionStream(format) 创建压缩 TransformStream，format ∈ "gzip" | "deflate" | "deflate-raw"；new DecompressionStream(format) 创建解压 TransformStream。两者均有 readable / writable，可 pipeThrough 串联到任意流管道。典型用法：inputStream.pipeThrough(new CompressionStream("gzip")).pipeTo(outputStream)；或配合 fetch：response.body.pipeThrough(new DecompressionStream("gzip")) 解压服务端 gzip 响应。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('压缩（gzip/deflate/raw）', { type: 'primary', size: 'sm', disabled: !caps.compression, onClick: () => this._compressString() }),
          this._btn('压缩→解压 round-trip', { size: 'sm', disabled: !caps.compression || !caps.decompression, onClick: () => this._decompressString() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '压缩 / 解压结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.compressionInfo || '（点击「压缩」或「压缩→解压 round-trip」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`// 压缩：流式 pipeThrough
const cs = new CompressionStream('gzip');
const writer = cs.writable.getWriter();
await writer.write(new TextEncoder().encode(text));
await writer.close();
const compressed = await new Response(cs.readable).arrayBuffer();
// 解压 fetch 响应（服务端 gzip）
const resp = await fetch(url);
const text = await new Response(resp.body.pipeThrough(new DecompressionStream('gzip'))).text();`)),
        h(Alert, {
          type: 'info',
          message: '三种格式区别：gzip / deflate / deflate-raw',
          description: 'gzip = deflate 数据 + CRC32 + 原始大小（最常用，HTTP Content-Encoding: gzip）；deflate = zlib 包装；deflate-raw = 裸 deflate 无包装。解压时 format 必须与压缩时一致。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：EventSource（SSE）===================

  // new EventSource(url) / new EventSource(url, { withCredentials })
  // source.onopen / source.onmessage / source.onerror / source.readyState / source.close()
  _openEventSource() {
    if (!this._caps().eventsource) {
      this._addLog('warn', 'EventSource 不可用（jsdom 可能未实现，需真实浏览器）');
      this.setState({
        eventSourceInfo:
          `EventSource 不可用：typeof EventSource === "undefined"\n测试环境不支持，请用真实浏览器打开本页。\n\n` + `服务端 SSE 响应格式（Content-Type: text/event-stream）：\n` + `  data: hello\\n\\n                 （默认 message 事件）\n` +
          `  event: update\\n data: {...}\\n\\n  （自定义事件）\n` + `  id: 123\\n data: msg\\n\\n          （lastEventId）\n` + `  retry: 5000\\n                    （重连间隔 ms）`,
      });
      return;
    }
    try {
      this._addLog('info', `new EventSource('${SSE_MOCK_URL}') —— 建立 SSE 连接…`);
      const source = new EventSource(SSE_MOCK_URL);
      this._eventSource = source;
      const rs = source.readyState;       // readyState：0=connecting, 1=open, 2=closed
      const url = source.url;
      const wc = source.withCredentials;
      // 注册事件回调
      source.onopen = () => {
        this._addLog('open', `onopen 触发：readyState=${source.readyState}（1=open）`);
        this.setState({
          eventSourceInfo:
            `new EventSource('${SSE_MOCK_URL}') → EventSource ✓\n` + `source.url = ${source.url}，withCredentials = ${source.withCredentials}\n` + `source.readyState = ${source.readyState}（1=open，连接已建立）\n` +
            `source.onopen 触发 ✓ —— 等待 onmessage 推送…`,
        });
      };
      source.onmessage = (event) => {
        this._addLog('message', `onmessage：data=${event.data}，lastEventId=${event.lastEventId}，origin=${event.origin}`);
        this.setState((s) => ({
          eventSourceInfo: s.eventSourceInfo + `\n\n[onmessage] data: ${event.data}\n  lastEventId=${event.lastEventId}，origin=${event.origin}`,
        }));
      };
      source.onerror = () => {
        this._addLog('warn', `onerror 触发：readyState=${source.readyState}（连接失败/断开，浏览器将自动重连）`);
        this.setState({
          eventSourceInfo:
            `new EventSource('${SSE_MOCK_URL}') → EventSource 对象（已创建）\n` + `初始 readyState = ${rs}（0=connecting）→ onerror 触发：readyState=${source.readyState}\n` +
            `说明：本地 ${SSE_MOCK_URL} 无 SSE 端点，连接失败后浏览器自动重连；\n` + `需真实 SSE 服务器（响应 Content-Type: text/event-stream）才能收到 onmessage。`,
        });
      };
      this.setState({
        eventSourceInfo:
          `new EventSource('${SSE_MOCK_URL}') → EventSource 对象 ✓\n` + `source.url = ${url}，withCredentials = ${wc}\n` + `source.readyState = ${rs}（0=connecting，正在建立连接）\n` +
          `已注册 onopen / onmessage / onerror 回调，等待事件…\n` + `（本地无 SSE 端点，预计 onerror 触发后自动重连）`,
      });
    } catch (err) {
      this._addLog('warn', `创建 EventSource 失败：${err.name} - ${err.message}`);
      this.setState({ eventSourceInfo: `创建 EventSource 失败：${err.name} - ${err.message}` });
    }
  }

  // source.close() —— 关闭 SSE 连接，停止自动重连
  _closeEventSource() {
    if (!this._caps().eventsource) { this._addLog('warn', 'EventSource 不可用'); return; }
    if (!this._eventSource) { this._addLog('warn', '请先点击「建立 SSE 连接」'); return; }
    try {
      const rsBefore = this._eventSource.readyState;
      this._eventSource.close();
      const rsAfter = this._eventSource.readyState;
      this._addLog('close', `source.close() 已调用：readyState ${rsBefore} → ${rsAfter}（2=closed，停止重连）`);
      this.setState({
        eventSourceInfo:
          `source.close() 已调用 ✓\n` + `close 前 readyState = ${rsBefore}\nclose 后 readyState = ${rsAfter}（2=closed）\n` + `说明：close 后连接关闭且不再自动重连；onopen/onmessage/onerror 不再触发。`,
      });
      this._eventSource = null;
    } catch (err) {
      this._addLog('warn', `close 失败：${err.name} - ${err.message}`);
    }
  }

  // 演示自定义事件：source.addEventListener('customEvent', cb)
  _addEventListenerDemo() {
    if (!this._caps().eventsource) { this._addLog('warn', 'EventSource 不可用'); return; }
    if (!this._eventSource) { this._addLog('warn', '请先点击「建立 SSE 连接」'); return; }
    try {
      this._eventSource.addEventListener('update', (event) => {
        this._addLog('custom', `自定义事件 'update'：data=${event.data}，lastEventId=${event.lastEventId}`);
        this.setState((s) => ({
          eventSourceInfo: s.eventSourceInfo + `\n\n[自定义事件 'update'] data: ${event.data}\n  lastEventId=${event.lastEventId}`,
        }));
      });
      this._addLog('info', "已 source.addEventListener('update', cb) —— 等待服务端推送 event: update\\n data: ...");
      this.setState({
        eventSourceInfo:
          `source.addEventListener('update', cb) 已注册 ✓\n` + `服务端需推送：event: update\\n data: {"value":42}\\n\\n\n` +
          `说明：默认 onmessage 只接收无 event: 字段的消息；带事件名的消息需用 addEventListener 监听；\n` + `  event 对象有 data / origin / lastEventId / source 属性。`,
      });
    } catch (err) {
      this._addLog('warn', `addEventListener 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. EventSource（Server-Sent Events / SSE）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.eventsource ? 'success' : 'error' }, caps.eventsource ? 'EventSource ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'onopen / onmessage / close'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new EventSource(url) / new EventSource(url, { withCredentials: true }) 建立 SSE 连接；source.url / source.readyState（0=connecting, 1=open, 2=closed）/ source.withCredentials；source.onopen / source.onmessage（默认 message 事件）/ source.onerror；source.addEventListener(eventName, cb) 监听自定义事件；source.close() 关闭连接并停止自动重连。服务端响应 Content-Type: text/event-stream，格式：data: text\\n\\n / event: name\\n / id: 123\\n / retry: 5000\\n。连接断开后浏览器自动重连，retry 字段控制间隔。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('建立 SSE 连接', { type: 'primary', size: 'sm', disabled: !caps.eventsource, onClick: () => this._openEventSource() }),
          this._btn('监听自定义事件', { size: 'sm', disabled: !caps.eventsource, onClick: () => this._addEventListenerDemo() }),
          this._btn('关闭连接', { danger: true, size: 'sm', disabled: !caps.eventsource, onClick: () => this._closeEventSource() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'EventSource 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.eventSourceInfo || '（点击「建立 SSE 连接」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '服务端 SSE 格式与参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`// 服务端响应（Content-Type: text/event-stream）
// data: hello\\n\\n                → onmessage 触发
// event: update\\n data: {...}\\n\\n → addEventListener('update')
// id: 123\\n data: msg\\n\\n         → lastEventId=123
// retry: 5000\\n                    → 断开后 5s 重连
// 客户端
const src = new EventSource('/events');
src.onmessage = (e) => console.log(e.data);
src.addEventListener('update', (e) => console.log(e.data));
src.close(); // 主动关闭，停止重连`)),
        h(Alert, {
          type: 'info',
          message: 'SSE vs WebSocket：单向推送 vs 双向通信',
          description: 'EventSource（SSE）是服务端→客户端单向推送，基于 HTTP/1.1 长连接，自动重连，文本协议，适合消息推送、AI 流式输出；WebSocket 是双向通信，适合聊天、协作。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：structuredClone ===================

  // structuredClone(value, options) —— 深拷贝，支持 Map/Set/Date/循环引用
  _cloneStructured() {
    if (!this._caps().structuredClone) {
      this._addLog('warn', 'structuredClone 不可用（需 Node 17+ 或较新浏览器）');
      this.setState({ cloneInfo: 'structuredClone 不可用：typeof structuredClone === "undefined"\n测试环境不支持，请用 Node 17+ 或较新浏览器打开。' });
      return;
    }
    try {
      // 构造含 Map/Set/Date/RegExp/循环引用的复杂对象
      const original = {
        name: 'advanced-network', nums: [1, 2, 3],
        map: new Map([['a', 1], ['b', 2]]), set: new Set([10, 20, 30]),
        date: new Date('2026-07-23T12:00:00Z'), regex: /https?:\/\/example\.com/gi,
        nested: { deep: { value: 42 } },
      };
      original.self = original;            // 循环引用
      original.nested.parent = original;   // 嵌套循环引用

      const cloned = structuredClone(original);   // 深拷贝（支持循环引用与内置类型）
      cloned.nums.push(99);                        // 修改副本，验证独立性
      cloned.map.set('c', 3);
      cloned.set.add(40);
      cloned.date.setFullYear(2025);

      const typeChecks = [
        `cloned.map instanceof Map = ${cloned.map instanceof Map}（原 map：${original.map instanceof Map}）`,
        `cloned.set instanceof Set = ${cloned.set instanceof Set}（原 set：${original.set instanceof Set}）`,
        `cloned.date instanceof Date = ${cloned.date instanceof Date}（原 date：${original.date instanceof Date}）`,
        `cloned.regex instanceof RegExp = ${cloned.regex instanceof RegExp}`,
        `cloned.self === cloned = ${cloned.self === cloned}（循环引用保留）`,
        `original.nums = [${original.nums.join(',')}]（副本 push(99) 不影响原对象）`,
        `original.date 年份 = ${original.date.getUTCFullYear()}（副本改年份不影响原对象）`,
      ];
      this._addLog('clone', `structuredClone 深拷贝成功：Map/Set/Date/RegExp/循环引用均保留，副本独立`);
      this.setState({
        cloneInfo:
          `structuredClone(original) → 深拷贝 ✓（支持循环引用）\n` + `原始对象含：Map / Set / Date / RegExp / 嵌套对象 / 循环引用（self）/ 嵌套循环（nested.parent）\n\n` +
          `类型保留与独立性验证：\n• ${typeChecks.join('\n• ')}\n\n` + `说明：structuredClone 支持结构化克隆算法类型（Map/Set/Date/RegExp/Error/ArrayBuffer/TypedArray/Blob/File 等），正确处理循环引用。`,
      });
    } catch (err) {
      this._addLog('warn', `structuredClone 失败：${err.name} - ${err.message}`);
      this.setState({ cloneInfo: `structuredClone 失败：${err.name} - ${err.message}` });
    }
  }

  // 对比 JSON.parse(JSON.stringify) 的局限：丢失 Map/Set/Date 类型，循环引用直接抛错
  _compareWithJson() {
    if (!this._caps().structuredClone) { this._addLog('warn', 'structuredClone 不可用'); return; }
    try {
      const original = {
        map: new Map([['a', 1]]), set: new Set([1, 2]),
        date: new Date('2026-07-23T00:00:00Z'), regex: /abc/gi,
        undef: undefined, fn: () => 'function', bigint: 42n,
      };
      // JSON 序列化：丢失类型
      let jsonLost;
      try {
        const jsonResult = JSON.parse(JSON.stringify(original));
        jsonLost = [
          `typeof jsonResult.map = ${typeof jsonResult.map}（Map → {} 空对象，类型丢失）`,
          `typeof jsonResult.date = ${typeof jsonResult.date}（Date → 字符串 "${jsonResult.date}"，类型丢失）`,
          `typeof jsonResult.regex = ${typeof jsonResult.regex}（RegExp → {} 空对象，类型丢失）`,
          `'undef' in jsonResult = ${'undef' in jsonResult}（undefined 被移除）`,
          `'fn' in jsonResult = ${'fn' in jsonResult}（function 被移除）`,
        ];
      } catch (err) {
        jsonLost = [`JSON.stringify 抛错：${err.name} - ${err.message}（BigInt 无法序列化）`];
      }
      // structuredClone：保留类型（但 function 不支持，会抛 DataCloneError）
      let scLost;
      try {
        const { fn, ...rest } = original;  // 删除不支持的 function
        const scResult = structuredClone(rest);
        scLost = [
          `scResult.map instanceof Map = ${scResult.map instanceof Map}（类型保留 ✓）`,
          `scResult.set instanceof Set = ${scResult.set instanceof Set}（类型保留 ✓）`,
          `scResult.date instanceof Date = ${scResult.date instanceof Date}（类型保留 ✓）`,
          `scResult.regex instanceof RegExp = ${scResult.regex instanceof RegExp}（类型保留 ✓）`,
          `'undef' in scResult = ${'undef' in scResult}（undefined 保留 ✓）`,
          `scResult.bigint = ${scResult.bigint}（BigInt 保留 ✓，typeof ${typeof scResult.bigint}）`,
        ];
      } catch (err) {
        scLost = [`structuredClone 抛错：${err.name} - ${err.message}`];
      }
      // 单独演示 function 会抛 DataCloneError
      let fnLine;
      try {
        structuredClone({ fn: () => 1 });
        fnLine = 'function：未抛错（意外）';
      } catch (err) {
        fnLine = `function：structuredClone({ fn }) → ${err.name}（Function 不可克隆，会抛 DataCloneError）`;
      }
      this._addLog('compare', `对比：JSON 丢失 Map/Set/Date/RegExp/undefined/BigInt/function；structuredClone 保留类型（function 除外）`);
      this.setState({
        cloneInfo:
          `对比 JSON.parse(JSON.stringify(obj)) 与 structuredClone(obj)\n\n` + `【JSON 方式】丢失类型：\n• ${jsonLost.join('\n• ')}\n\n` + `【structuredClone 方式】保留类型：\n• ${scLost.join('\n• ')}\n\n` +
          `${fnLine}\n\n` + `结论：JSON 适合纯数据；structuredClone 是真正的深拷贝，支持 Map/Set/Date/RegExp/ArrayBuffer 与循环引用，但不支持 Function / DOM 节点 / Symbol 属性。`,
      });
    } catch (err) {
      this._addLog('warn', `对比失败：${err.name} - ${err.message}`);
      this.setState({ cloneInfo: `对比失败：${err.name} - ${err.message}` });
    }
  }

  // structuredClone(value, { transfer }) —— 转移 ArrayBuffer 所有权（原 buffer 变 detached）
  _cloneWithTransfer() {
    if (!this._caps().structuredClone) { this._addLog('warn', 'structuredClone 不可用'); return; }
    try {
      const buffer = new ArrayBuffer(8);
      const view = new Uint8Array(buffer);
      view[0] = 0x41; view[1] = 0x42; view[2] = 0x43;
      const beforeLen = buffer.byteLength;
      // structuredClone(value, { transfer: [buffer] }) 转移所有权
      const cloned = structuredClone({ data: buffer, meta: 'transferred' }, { transfer: [buffer] });
      const afterLen = buffer.byteLength;             // 转移后原 buffer 变为 detached
      const clonedLen = cloned.data.byteLength;
      const clonedBytes = Array.from(new Uint8Array(cloned.data));
      this._addLog('transfer', `transfer ArrayBuffer：原 buffer ${beforeLen}B → ${afterLen}B（detached），克隆 ${clonedLen}B，字节=[${clonedBytes.join(',')}]`);
      this.setState({
        cloneInfo:
          `structuredClone(value, { transfer: [buffer] }) —— 转移可转移对象所有权\n\n` + `原始 ArrayBuffer：byteLength = ${beforeLen}，前 3 字节 = [${Array.from(view).join(',')}]\n` + `调用 structuredClone({ data: buffer }, { transfer: [buffer] })\n\n` +
          `转移后：\n` + `  原 buffer.byteLength = ${afterLen}（${afterLen === 0 ? '已 detached，所有权转移' : '仍持有'}）\n` +
          `  cloned.data.byteLength = ${clonedLen}（持有数据），前 ${clonedBytes.length} 字节 = [${clonedBytes.join(',')}]\n\n` + `说明：transfer 转移 ArrayBuffer / MessagePort / ImageBitmap 等所有权（零拷贝），原对象变 detached；典型场景：Web Worker postMessage(message, [transfer])。`,
      });
    } catch (err) {
      this._addLog('warn', `transfer 演示失败：${err.name} - ${err.message}`);
      this.setState({ cloneInfo: `transfer 演示失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. structuredClone 深度克隆',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.structuredClone ? 'success' : 'error' }, caps.structuredClone ? 'structuredClone ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '深拷贝 / transfer'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'structuredClone(value, options) 执行深拷贝，支持 Map/Set/Date/RegExp/Error/ArrayBuffer/TypedArray/Blob/File 等，正确处理循环引用（不会栈溢出）。options.transfer 转移 ArrayBuffer / MessagePort / ImageBitmap 等可转移对象的所有权（零拷贝，原对象变 detached）。不支持 Function / DOM 节点 / Symbol 属性（抛 DataCloneError）。相比 JSON.parse(JSON.stringify()) 不丢失类型、支持循环引用，是真正的深拷贝。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('深拷贝（Map/Set/Date/循环）', { type: 'primary', size: 'sm', disabled: !caps.structuredClone, onClick: () => this._cloneStructured() }),
          this._btn('对比 JSON 序列化', { size: 'sm', disabled: !caps.structuredClone, onClick: () => this._compareWithJson() }),
          this._btn('transfer ArrayBuffer', { size: 'sm', disabled: !caps.structuredClone, onClick: () => this._cloneWithTransfer() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '克隆结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.cloneInfo || '（点击「深拷贝」/「对比 JSON」/「transfer」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`// 深拷贝（保留类型 + 循环引用）
const obj = { map: new Map(), set: new Set(), date: new Date() };
obj.self = obj;                       // 循环引用
const copy = structuredClone(obj);    // ✓ 类型保留，循环保留
// transfer 零拷贝（原 buffer 变 detached）
const buf = new ArrayBuffer(1024);
const clone = structuredClone({ data: buf }, { transfer: [buf] });
buf.byteLength;                       // 0（已转移）
clone.data.byteLength;                // 1024`)),
        h(Alert, {
          type: 'warning',
          message: 'structuredClone 不支持 Function / DOM 节点 / Symbol 属性',
          description: '结构化克隆算法仅支持可序列化数据类型：Map/Set/Date/RegExp/Error/ArrayBuffer/TypedArray/Blob/File 等；Function、DOM 节点、Symbol 属性会抛 DataCloneError。',
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
      h('h2', { class: 'section-title' }, '高级网络 API 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 WebTransport（QUIC/HTTP3）、URLPattern、Compression Streams、EventSource（SSE）、structuredClone 等现代浏览器网络与数据 API。所有 API 调用前做能力检测，不可用时仅记日志。'),
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
