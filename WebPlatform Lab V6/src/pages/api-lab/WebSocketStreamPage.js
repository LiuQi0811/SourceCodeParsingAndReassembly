// =====================================================================
// WebSocketStreamPage.js —— WebSocketStream 与 WebSocket 背压深度实验室
// 演示 MDN / Chrome Explainer：WebSocketStream（基于 Streams API 的 WebSocket
//           背压封装）、permessage-deflate（RFC 7692）、ReadableStream BYOB、
//           WritableStream 自然反压、AbortSignal 中止、关闭握手。
// 说明：WebSocketStream 是 Chrome 推出的 Streams-based WebSocket 实验性 API
//       （origin trial），将传统 WebSocket 包装成 readable / writable 双向流，
//       天然支持背压（backpressure）。传统 WebSocket 仅有 bufferedAmount 这一
//       「事后」指标，无下游消费速率感知；WebSocketStream 通过 Streams API
//       的 writer.ready / reader.read() Promise 让生产者自然感知下游消费速率。
//       jsdom/Node 环境无 WebSocketStream，所有 API 调用前做 typeof 能力检测，
//       不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。背压机制通过纯
//       JS setTimeout 队列模拟（无需真实网络与 Streams）直观演示。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// 能力检测清单（逐项 typeof 探测，覆盖本页涉及的全部底层 API）
const WSS_FEATURES = [
  'WebSocketStream',   // 本页主角：Chrome 实验 origin trial
  'WebSocket',         // 对照组：传统 WebSocket（无背压）
  'ReadableStream',    // 读取流（支持 BYOB reader）
  'WritableStream',    // 写入流（writer.ready 反压）
  'AbortController',   // 中止信号
  'ByteLengthQueuingStrategy', // 按字节计数的排队策略
];

export class WebSocketStreamPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],               // 统一日志（{ type, content, time }）
      capsSummary: '',        // 顶部能力检测汇总
      overviewInfo: '',       // Card 1：概述与动机 + 与 WebSocket 对比 + 浏览器支持
      connInfo: '',           // Card 2：构造与连接 + opened/closed/ready Promise
      readInfo: '',           // Card 3：readable 流读取 + BYOB reader
      writeInfo: '',          // Card 4：writable 写入与背压 + highWaterMark
      binaryInfo: '',         // Card 5：二进制类型与 permessage-deflate 协议扩展
      abortInfo: '',          // Card 6：AbortSignal 中止与关闭握手
      marketInfo: '',         // Card 7：实战：低延迟行情推送
      decisionInfo: '',       // Card 8：vs WebSocket / WebTransport / SSE 决策矩阵
      simRunning: false,      // 背压模拟是否运行中
      simStats: '',           // 背压模拟实时统计
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];
    this._wsStream = null;   // 若真实环境创建过 WebSocketStream，销毁时关闭
    this._sim = null;        // 背压模拟的可变状态句柄

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `WebSocketStream ${c(f.webSocketStream)}`,
      `WebSocket ${c(f.webSocket)}`,
      `ReadableStream ${c(f.readableStream)}`,
      `WritableStream ${c(f.writableStream)}`,
      `AbortController ${c(f.abortController)}`,
      `ByteLengthQueuingStrategy ${c(f.byteLengthQueuingStrategy)}`,
    ];

    const any = f.webSocketStream;
    const summary = any
      ? `WebSocketStream 能力检测：${parts.join(' · ')}。当前环境支持 WebSocketStream（Chrome 实验 API），可真实体验 readable/writable 背压；连接需 wss:// 服务端配合。`
      : `WebSocketStream 能力检测：${parts.join(' · ')}。jsdom/Node 环境无 WebSocketStream（Chrome 实验 origin trial），所有按钮点击仅记日志说明，绝不抛异常；真实 Chrome（开启实验 flag 或 origin trial）可完整体验。本页背压机制另提供纯 JS 模拟演示，无需网络。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.webSocketStream) {
      this._addLog('warn', 'WebSocketStream 不可用（Chrome 实验性 API，需 origin trial 或 chrome://flags 开启，jsdom/Node/Firefox/Safari 均无）');
    }
    if (!f.webSocket) this._addLog('warn', 'WebSocket 不可用（jsdom 默认无，仅作对照组展示）');
    if (!f.readableStream) this._addLog('warn', 'ReadableStream 不可用（BYOB reader 演示跳过）');
    if (!f.writableStream) this._addLog('warn', 'WritableStream 不可用（writer.ready 反压演示跳过）');
    if (!f.abortController) this._addLog('warn', 'AbortController 不可用（signal 中止演示跳过）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 关闭可能创建过的 WebSocketStream（jsdom 中恒为 null）
    this._closeWsStream();
    // 停止背压模拟定时器
    this._stopSim();
    // 移除动态注入的样式
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 辅助方法 ——

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _injectStyle(id, css) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  _flags() {
    const safe = (fn) => {
      try { return fn(); } catch { return false; }
    };
    return {
      webSocketStream: safe(() => typeof WebSocketStream !== 'undefined'),
      webSocket: safe(() => typeof WebSocket !== 'undefined'),
      readableStream: safe(() => typeof ReadableStream !== 'undefined'),
      writableStream: safe(() => typeof WritableStream !== 'undefined'),
      abortController: safe(() => typeof AbortController !== 'undefined'),
      byteLengthQueuingStrategy: safe(() => typeof ByteLengthQueuingStrategy !== 'undefined'),
    };
  }

  _closeWsStream() {
    if (this._wsStream) {
      try {
        // WebSocketStream 通过 close(code, reason) 发起关闭握手
        this._wsStream.close?.(1000, 'component unmount');
      } catch { /* noop */ }
      this._wsStream = null;
    }
  }

  _stopSim() {
    if (this._sim) {
      this._sim.stopped = true;
      try { clearTimeout(this._sim.producerTimer); } catch { /* noop */ }
      try { clearTimeout(this._sim.consumerTimer); } catch { /* noop */ }
      try { clearTimeout(this._sim.reportTimer); } catch { /* noop */ }
      this._sim = null;
    }
  }

  _injectBaseStyles() {
    this._injectStyle('wss-base', `
      .wss-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .wss-sim {
        margin-top: 10px;
        padding: 12px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 8px;
        font-family: monospace;
        font-size: 12px;
        line-height: 1.6;
      }
      .wss-sim-bar-wrap {
        margin-top: 8px;
        background: #1e293b;
        border-radius: 4px;
        height: 18px;
        overflow: hidden;
        position: relative;
      }
      .wss-sim-bar {
        height: 100%;
        background: linear-gradient(90deg, #22c55e, #eab308 60%, #ef4444);
        transition: width 0.15s ease;
      }
      .wss-sim-threshold {
        position: absolute;
        top: 0; bottom: 0;
        width: 2px;
        background: #f8fafc;
        opacity: 0.6;
      }
      .wss-matrix {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .wss-matrix-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
      }
      .wss-matrix-title { font-weight: 600; color: #1e293b; margin-bottom: 4px; }
      .wss-flow {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
        font-size: 12px;
      }
      .wss-flow-node {
        padding: 4px 8px;
        border-radius: 6px;
        background: #e0e7ff;
        color: #1e40af;
        font-weight: 600;
      }
      .wss-flow-node--bp { background: #fee2e2; color: #991b1b; }
      .wss-flow-arrow { color: #64748b; }
      .wss-status {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .wss-status--ok { background: #dcfce7; color: #166534; }
      .wss-status--no { background: #fee2e2; color: #991b1b; }
      .wss-status--run { background: #dbeafe; color: #1e40af; }
      .wss-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
      }
    `);
  }

  // ===================== Card 1：概述与动机 =====================

  _runOverviewDemo() {
    const f = this._flags();
    this._injectStyle('wss-overview-demo', `
      .wss-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== WebSocketStream 概述与动机 =====',
      '',
      '【传统 WebSocket 的背压痛点】',
      '  传统 new WebSocket(url) 是基于事件回调的 API：',
      '    ws.onmessage = (e) => { /* 处理 e.data */ };',
      '    ws.send(data);  // 立即返回，不感知对端是否消费',
      '',
      '  问题：',
      '  1. 无背压（backpressure）：send() 同步返回，数据进入浏览器内部缓冲区，',
      '     若对端消费慢，缓冲区持续膨胀，最终 OOM 或网络拥塞。',
      '  2. bufferedAmount 是「事后」指标：只能轮询 ws.bufferedAmount 判断积压，',
      '     无法在 send 时自然阻塞生产者。',
      '  3. 消息边界处理：onmessage 一次性交付整帧，无流式读取，大帧需自行分片。',
      '  4. 二进制类型需手动设 binaryType："arraybuffer" | "blob"，否则默认 blob。',
      '  5. 关闭码/原因只能通过 close 事件被动接收，无 Promise 化的关闭握手。',
      '',
      '【WebSocketStream：Streams-based WebSocket】',
      '  Chrome 提出的实验性 API（origin trial），将 WebSocket 包装为双向流：',
      '    const wss = new WebSocketStream(url, { protocols, signal });',
      '    const { readable, writable, protocol, extensions } = await wss.opened;',
      '    // readable: ReadableStream<Uint8Array>  —— 消费对端消息（带背压）',
      '    // writable: WritableStream<Uint8Array>  —— 向对端写入（带背压）',
      '    await wss.closed;  // 关闭握手 Promise，解析 { closeCode, reason }',
      '',
      '  优势：',
      '  ✓ 天然背压：reader.read() / writer.ready Promise 让生产者自然感知下游速率',
      '  ✓ 流式消费：可 BYOB reader 零拷贝读取到指定 ArrayBuffer',
      '  ✓ Promise 化：opened / closed 是 Promise，告别回调地狱',
      '  ✓ AbortSignal：原生支持 AbortController 中止连接',
      '  ✓ 与 Streams API 生态互通：可 pipeTo / pipeThrough TransformStream',
      '',
      '【WebSocketStream vs WebSocket 对比】',
      '  维度              WebSocket                  WebSocketStream',
      '  ----------------------------------------------------------------',
      '  编程模型          事件回调(onmessage)         Streams(readable/writable)',
      '  背压              ✗ 仅 bufferedAmount 轮询    ✓ writer.ready 自然反压',
      '  读取方式          整帧交付                    流式 + BYOB reader',
      '  二进制类型        binaryType 手动设           恒为 Uint8Array',
      '  关闭              close 事件回调              closed Promise { closeCode, reason }',
      '  中止              close() 无 AbortSignal      { signal } 原生 AbortController',
      '  互操作            独立                        与 TransformStream pipeTo 互通',
      '  成熟度            ✓ 全平台稳定                ✗ Chrome 实验 origin trial',
      '',
      '【浏览器支持】',
      '  Chrome：    实验（需 origin trial 或 chrome://flags#enable-experimental-web-platform-features）',
      '  Edge：      同 Chromium 内核，跟随 Chrome',
      '  Firefox：   ✗ 未实现（截至 2025）',
      '  Safari：    ✗ 未实现（截至 2025）',
      '  Node.js：   ✗ 无（Node 有独立的 ws 包，非 Web WebSocketStream）',
      '  jsdom：     ✗ 无（本页所有检测为 false）',
      '',
      '  说明：WebSocketStream 当前仍处于 Explainer 阶段（非 W3C/WHATWG 标准），',
      '  生产环境需 Polyfill（基于 WebSocket + bufferedAmount + ReadableStream 包装）。',
      '',
      '【与 WebTransport 的关系】',
      '  WebTransport（HTTP/3）：原生流式 + 数据报，QUIC 多路复用，0-RTT 低延迟；',
      '  WebSocketStream：仍基于 WebSocket（TCP/HTTP1.1 升级），保留 WebSocket 语义，',
      '  仅补齐背压能力。两者互补：WebTransport 走 QUIC、WebSocketStream 走 TCP。',
      '',
      '【能力检测代码】',
      "  // 一次性检测本页涉及的全部底层 API",
      "  const supported = typeof WebSocketStream !== 'undefined';",
      "  const hasWebSocket = typeof WebSocket !== 'undefined';",
      "  const hasReadableStream = typeof ReadableStream !== 'undefined';",
      "  const hasWritableStream = typeof WritableStream !== 'undefined';",
      "  const hasAbortController = typeof AbortController !== 'undefined';",
      '',
      '【实际能力检测演示】',
      `  WebSocketStream: ${f.webSocketStream ? '✓' : '✗'}`,
      `  WebSocket: ${f.webSocket ? '✓' : '✗'}`,
      `  ReadableStream: ${f.readableStream ? '✓' : '✗'}`,
      `  WritableStream: ${f.writableStream ? '✓' : '✗'}`,
      `  AbortController: ${f.abortController ? '✓' : '✗'}`,
      `  ByteLengthQueuingStrategy: ${f.byteLengthQueuingStrategy ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. WebSocketStream 非标准，生产必须 Polyfill 降级到 WebSocket',
      '  2. opened Promise 解析后才拿到 readable/writable，构造后不能直接 .readable',
      '  3. readable 的 chunk 恒为 Uint8Array，文本需自行 TextDecoder 解码',
      '  4. writable write 的 chunk 必须是 BufferSource（Uint8Array/ArrayBuffer）',
      '  5. closed 解析的关闭码字段在 Explainer 中为 closeCode（部分文档记作 code）',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('wss', `概述演示完成：WebSocketStream=${f.webSocketStream}，WebSocket=${f.webSocket}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— 传统 WebSocket 背压痛点 + WebSocketStream 对比 + 浏览器支持',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['WebSocketStream', f.webSocketStream],
          ['WebSocket', f.webSocket],
        ]),
        h(Tag, { color: 'primary' }, '概述'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '传统 WebSocket 无背压：send() 同步返回不感知对端消费速率，仅能轮询 bufferedAmount。WebSocketStream（Chrome 实验 origin trial）将 WebSocket 包装为 readable/writable 双向流，通过 writer.ready / reader.read() Promise 天然反压，并支持 AbortSignal 与 Promise 化关闭握手。浏览器支持：仅 Chrome/Edge 实验性，Firefox/Safari/Node/jsdom 均无，生产需 Polyfill。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行概述演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 传统 WebSocket：无背压
const ws = new WebSocket('wss://example.com/stream');
ws.onmessage = (e) => handle(e.data);
ws.send(hugeBuffer); // 立即返回，缓冲区可能爆掉
console.log(ws.bufferedAmount); // 仅事后指标

// WebSocketStream：Streams-based，天然背压
const wss = new WebSocketStream('wss://example.com/stream');
const { readable, writable } = await wss.opened;
const reader = readable.getReader();
while (true) {
  const { value, done } = await reader.read(); // 下游慢则阻塞
  if (done) break;
  handle(value); // value: Uint8Array
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 WebSocketStream 概述与动机完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：构造与连接 =====================

  _runConnDemo() {
    const f = this._flags();
    this._injectStyle('wss-conn-demo', `
      .wss-conn-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    // jsdom 无 WebSocketStream，仅记日志说明，绝不真实建连
    if (!f.webSocketStream) {
      this._addLog('warn', 'WebSocketStream 不可用，跳过真实建连（jsdom 无此 API，真实 Chrome 需 wss:// 服务端配合）');
    } else {
      this._addLog('info', '检测到 WebSocketStream，但本页不连接真实 wss 服务，仅展示 API 用法');
    }
    const info = [
      '===== 构造与连接：WebSocketStream 构造与三大 Promise =====',
      '',
      '【构造签名】',
      '  new WebSocketStream(url, options?)',
      '',
      '  参数：',
      '    url        string —— 必须，ws:// 或 wss://（生产应 wss://）',
      '    options    object —— 可选',
      '      protocols: string | string[]  子协议协商（同 WebSocket 第二参）',
      '      signal:   AbortSignal          AbortController 信号，中止连接/握手',
      '',
      '  const wss = new WebSocketStream("wss://example.com/stream", {',
      '    protocols: ["chat", "superchat"],',
      '    signal: ac.signal,',
      '  });',
      '',
      '【三大 Promise 属性】',
      '  wss.opened  —— 连接成功后 resolve，解析 { readable, writable, protocol, extensions }',
      '  wss.closed  —— 关闭握手完成后 resolve，解析 { closeCode, reason }',
      '  wss.ready   —— （部分实现）连接就绪的别名，与 opened 等价或废弃',
      '',
      '  注：构造后不能立即访问 wss.readable，必须 await wss.opened 拿到字典。',
      '',
      '【opened 解析值】',
      '  const { readable, writable, protocol, extensions } = await wss.opened;',
      '  // readable:    ReadableStream<Uint8Array>  对端→本端',
      '  // writable:    WritableStream<Uint8Array>  本端→对端',
      '  // protocol:    string | ""  协商成功的子协议（同 WebSocket.protocol）',
      '  // extensions:  string | ""  协商成功的扩展（如 "permessage-deflate"）',
      '',
      '【与 new WebSocket() 的 API 差异】',
      '  WebSocket（事件式）：',
      '    const ws = new WebSocket(url, protocols);',
      '    ws.readyState;        // 0/1/2/3',
      '    ws.onopen = ...;       // 连接打开回调',
      '    ws.onmessage = ...;    // 消息回调',
      '    ws.onclose = ...;      // 关闭回调（CloseEvent { code, reason }）',
      '    ws.send(data);         // 同步发送',
      '    ws.close(code, reason);',
      '',
      '  WebSocketStream（Promise/Stream 式）：',
      '    const wss = new WebSocketStream(url, { protocols, signal });',
      '    const { readable, writable } = await wss.opened;',
      '    // 读取：const { value, done } = await reader.read();',
      '    // 写入：await writer.write(chunk);',
      '    const { closeCode, reason } = await wss.closed;',
      '    wss.close(code, reason);',
      '',
      '【readyState 的消失】',
      '  WebSocketStream 没有 readyState 数字属性，状态由 Promise 表达：',
      '    pending  opened  → 连接中',
      '    resolved opened  → 已连接',
      '    rejected opened  → 连接失败（抛 DOMException）',
      '    resolved closed  → 已正常关闭',
      '',
      '【完整建连示例】',
      '  async function connect() {',
      '    const wss = new WebSocketStream("wss://example.com/stream");',
      '    try {',
      '      const { readable, writable, protocol, extensions } = await wss.opened;',
      '      console.log("已连接，子协议:", protocol, "扩展:", extensions);',
      '      // ... 使用 readable / writable',
      '    } catch (err) {',
      '      console.error("连接失败:", err);',
      '    }',
      '  }',
      '',
      '【连接失败的错误处理】',
      '  // opened 可能 reject（如服务端拒绝、TLS 失败、protocols 协商失败）',
      '  try {',
      '    const { readable } = await wss.opened;',
      '  } catch (err) {',
      '    // err: DOMException，name 可能是 "NetworkError" / "SecurityError"',
      '  }',
      '',
      '【浏览器支持】',
      `  WebSocketStream: ${f.webSocketStream ? '✓' : '✗'}（Chrome 实验）`,
      `  WebSocket: ${f.webSocket ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. opened 必须 await，构造后直接读 wss.readable 会得到 undefined',
      '  2. protocols 协商失败时 opened reject（非静默回退）',
      '  3. ws:// 明文仅在 localhost 可用，生产必须 wss://',
      '  4. 同源策略不限制 WebSocket，但服务端应校验 Origin 头防 CSRF',
      '  5. closed 的字段在 Explainer 中为 closeCode（部分早期文档写作 code）',
    ].join('\n');
    this.setState({ connInfo: info });
    this._addLog('wss', `构造与连接演示完成：opened/closed/ready 三大 Promise`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. 构造与连接 —— new WebSocketStream(url, { protocols, signal }) + opened/closed/ready',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['WebSocketStream', f.webSocketStream],
          ['AbortController', f.abortController],
        ]),
        h(Tag, { color: 'primary' }, '构造'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new WebSocketStream(url, { protocols, signal }) 构造，三大 Promise 属性：opened（解析 { readable, writable, protocol, extensions }）、closed（解析 { closeCode, reason }）、ready。与 new WebSocket() 的关键差异：无 readyState 数字属性，状态由 Promise 表达；构造后必须 await wss.opened 才能拿到 readable/writable。protocols 协商失败时 opened reject。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行构造演示', { type: 'primary', size: 'sm', onClick: () => this._runConnDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const wss = new WebSocketStream('wss://example.com/stream', {
  protocols: ['chat'],
  signal: ac.signal, // AbortController 信号
});

try {
  const { readable, writable, protocol, extensions } = await wss.opened;
  console.log('已连接 protocol=%s extensions=%s', protocol, extensions);
  // readable / writable 见 Card 3 / Card 4
} catch (err) {
  console.error('连接失败:', err.name, err.message);
}

// 关闭握手（见 Card 6）
const { closeCode, reason } = await wss.closed;
console.log('关闭 code=%d reason=%s', closeCode, reason);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.connInfo || '（点击按钮查看 WebSocketStream 构造与连接完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：readable 流读取 =====================

  _runReadDemo() {
    const f = this._flags();
    this._injectStyle('wss-read-demo', `
      .wss-read-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webSocketStream) {
      this._addLog('warn', 'WebSocketStream 不可用，readable 读取仅展示 API 用法（jsdom 无此 API）');
    }
    // 若环境有 ReadableStream，演示 default reader 循环（不依赖网络）
    if (f.readableStream) {
      try {
        const rs = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('模拟帧-1'));
            controller.enqueue(new TextEncoder().encode('模拟帧-2'));
            controller.close();
          },
        });
        const reader = rs.getReader();
        (async () => {
          const out = [];
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            out.push(new TextDecoder().decode(value));
          }
          this._addLog('info', `ReadableStream 模拟读取成功：${out.join(' | ')}（演示 value/done 循环）`);
        })().catch((e) => this._addLog('warn', `模拟读取失败：${e && e.message}`));
      } catch (err) {
        this._addLog('warn', `ReadableStream 构造失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'ReadableStream 不可用，跳过本地读取模拟');
    }
    const info = [
      '===== readable 流读取：getReader / BYOB / value-done 循环 =====',
      '',
      '【从 opened 拿到 readable】',
      '  const { readable } = await wss.opened;',
      '  // readable: ReadableStream<Uint8Array>',
      '',
      '【默认 reader：getReader()】',
      '  const reader = readable.getReader();',
      '  while (true) {',
      '    const { value, done } = await reader.read();',
      '    if (done) break;',
      '    // value: Uint8Array —— 对端发来的一个消息帧（已按帧边界切分）',
      '    handleFrame(value);',
      '  }',
      '  await reader.closed;',
      '',
      '【value/done 循环语义】',
      '  value: Uint8Array | undefined',
      '    - 对端发来的一个完整消息（WebSocket 帧边界保留，非字节流）',
      '    - 文本消息也是 Uint8Array，需 TextDecoder 解码',
      '    - close 时 value 为 undefined',
      '  done: boolean',
      '    - true 表示流结束（对端关闭或本地 cancel）',
      '',
      '【文本消息解码】',
      '  const decoder = new TextDecoder("utf-8");',
      '  const reader = readable.getReader();',
      '  while (true) {',
      '    const { value, done } = await reader.read();',
      '    if (done) break;',
      '    const text = decoder.decode(value, { stream: true });',
      '    console.log(text);',
      '  }',
      '  decoder.decode(); // flush 末尾残缺字节',
      '',
      '【BYOB reader：getReader({ mode: "byob" })】',
      '  // BYOB = Bring Your Own Buffer，零拷贝读取到调用方提供的 ArrayBuffer',
      '  // 适合大流量二进制场景，避免每帧分配新 Uint8Array',
      '  const reader = readable.getReader({ mode: "byob" });',
      '  const buffer = new ArrayBuffer(4096);',
      '  while (true) {',
      '    const { value, done } = await reader.read(new Uint8Array(buffer));',
      '    if (done) break;',
      '    // value: Uint8Array，是 buffer 的视图（同一内存），长度为实际读取字节',
      '    console.log("收到", value.byteLength, "字节");',
      '  }',
      '',
      '  注意：BYOB reader 要求 readable 锁定模式为 byob；若流不支持会抛 TypeError。',
      '  WebSocketStream 的 readable 支持两种 reader 模式。',
      '',
      '【释放锁与取消】',
      '  reader.releaseLock();  // 释放锁，让其他 reader 可读（流未关闭）',
      '  await reader.cancel(reason);  // 主动取消流，触发底层关闭',
      '',
      '【tee() 分流】',
      '  // 将 readable 拆成两条独立流，可分别消费（如一条落盘、一条实时处理）',
      '  const [a, b] = readable.tee();',
      '  consumeLog(a);   // 落盘分支',
      '  consumeLive(b);  // 实时分支',
      '',
      '【pipeTo / pipeThrough 互操作】',
      '  // 与 Streams 生态互通：直接 pipe 到 WritableStream 或经过 TransformStream',
      '  await readable.pipeTo(writable);              // 透传到另一条流',
      '  const through = new TransformStream({...});',
      '  await readable.pipeThrough(through).pipeTo(sink);',
      '',
      '【背压如何体现】',
      '  await reader.read() 会在下游未消费时挂起，TCP 接收窗口随之收缩，',
      '  对端 send() 被阻塞 → 全链路背压。这是 WebSocketStream 的核心收益。',
      '',
      '【浏览器支持】',
      `  WebSocketStream: ${f.webSocketStream ? '✓' : '✗'}`,
      `  ReadableStream: ${f.readableStream ? '✓' : '✗'}（BYOB 需 streams 库较新版本）`,
      '',
      '【常见陷阱】',
      '  1. value 是 Uint8Array 不是 string，文本必须 TextDecoder',
      '  2. 一个 value 对应一个 WebSocket 帧（消息边界保留），不是任意字节切片',
      '  3. BYOB reader 读到的 value 是传入 buffer 的视图，复用需小心',
      '  4. reader 未 releaseLock 前不能再 getReader()，否则抛 TypeError',
      '  5. tee() 两条流背压相互独立，慢分支会让快分支也积压',
    ].join('\n');
    this.setState({ readInfo: info });
    this._addLog('wss', 'readable 流读取演示完成（含本地 ReadableStream 模拟 value/done 循环）');
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. readable 流读取 —— getReader / BYOB reader / value-done 循环',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['ReadableStream', f.readableStream],
          ['WebSocketStream', f.webSocketStream],
        ]),
        h(Tag, { color: 'primary' }, '读取'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '从 wss.opened 拿到 readable: ReadableStream<Uint8Array>。getReader() 默认 reader，循环 await reader.read() 拿 { value, done }；value 是 Uint8Array（一帧消息边界保留），文本需 TextDecoder 解码。getReader({ mode: "byob" }) 拿 BYOB reader，read(new Uint8Array(buffer)) 零拷贝读取到调用方 buffer。支持 tee() 分流、pipeTo/pipeThrough 与 Streams 生态互通。reader.read() 在下游慢时挂起 → TCP 接收窗口收缩 → 对端阻塞，全链路背压。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行读取演示', { type: 'primary', size: 'sm', onClick: () => this._runReadDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const { readable } = await wss.opened;
const decoder = new TextDecoder('utf-8');

// —— 默认 reader：value/done 循环 ——
const reader = readable.getReader();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value, { stream: true }));
}

// —— BYOB reader：零拷贝读取到自有 buffer ——
const byobReader = readable.getReader({ mode: 'byob' });
const buf = new ArrayBuffer(4096);
while (true) {
  const { value, done } = await byobReader.read(new Uint8Array(buf));
  if (done) break;
  console.log('收到', value.byteLength, '字节');
}

// —— pipeThrough 与 TransformStream 互通 ——
const through = new TransformStream({
  transform(chunk, ctrl) { ctrl.enqueue(decoder.decode(chunk)); },
});
await readable.pipeThrough(through).pipeTo(logSink);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.readInfo || '（点击按钮查看 readable 流读取完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：writable 写入与背压 =====================

  _runWriteDemo() {
    const f = this._flags();
    this._injectStyle('wss-write-demo', `
      .wss-write-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webSocketStream) {
      this._addLog('warn', 'WebSocketStream 不可用，writable 写入仅展示 API 用法（jsdom 无此 API）');
    }
    const info = [
      '===== writable 写入与背压：writer.ready / write / highWaterMark =====',
      '',
      '【从 opened 拿到 writable】',
      '  const { writable } = await wss.opened;',
      '  // writable: WritableStream<Uint8Array>',
      '',
      '【默认 writer：getWriter()】',
      '  const writer = writable.getWriter();',
      '  await writer.ready;            // 等待下游准备好（背压核心）',
      '  await writer.write(chunk);     // chunk: Uint8Array / ArrayBuffer',
      '  await writer.close();          // 正常关闭写端（发送 close 帧）',
      '',
      '【writer.ready：背压感知的关键】',
      '  // writer.ready 是一个 Promise，resolve 表示下游（网络）可接受更多数据',
      '  // 当 TCP 发送窗口满或对端消费慢时，ready 保持 pending，生产者自然阻塞',
      '  async function pump(source, writer) {',
      '    for (const chunk of source) {',
      '      await writer.ready;        // ← 背压点：下游慢则挂起',
      '      await writer.write(chunk);',
      '    }',
      '    await writer.close();',
      '  }',
      '',
      '【writer.write() 的返回值】',
      '  // write() 返回 Promise，resolve 表示该 chunk 已被流接受（非到达对端）',
      '  // 不要在 ready 之前连续 write，否则内部队列积压（丧失背压）',
      '  await writer.ready;',
      '  await writer.write(chunk1);',
      '  await writer.ready;            // ← 再次等待，确保背压生效',
      '  await writer.write(chunk2);',
      '',
      '【highWaterMark 与排队策略】',
      '  // WritableStream 的 highWaterMark 决定何时认为「队列满」（背压触发点）',
      '  // WebSocketStream 的 writable 默认使用 ByteLengthQueuingStrategy',
      '  //   highWaterMark 默认值由实现决定（通常较小，如 16KB ~ 1MB）',
      '',
      '  // 自定义策略（若构造可传 options）',
      '  const strategy = new ByteLengthQueuingStrategy({ highWaterMark: 64 * 1024 });',
      '  // writer.desiredSize = highWaterMark - 已排队字节数',
      '  // desiredSize <= 0 时 writer.ready 保持 pending → 背压',
      '',
      '【desiredSize 判断背压】',
      '  const writer = writable.getWriter();',
      '  while (hasData()) {',
      '    const chunk = nextChunk();',
      '    if (writer.desiredSize > 0) {',
      '      await writer.write(chunk);   // 队列未满，直接写',
      '    } else {',
      '      await writer.ready;          // 队列满，等下游消费',
      '      await writer.write(chunk);',
      '    }',
      '  }',
      '',
      '【CountQueuingStrategy vs ByteLengthQueuingStrategy】',
      '  CountQueuingStrategy({ highWaterMark: N })   按 chunk 个数计，每 chunk 算 1',
      '  ByteLengthQueuingStrategy({ highWaterMark })  按 chunk.byteLength 计',
      '  WebSocketStream 二进制场景适合 ByteLength（按字节感知积压）。',
      '',
      '【关闭写端：close vs abort】',
      '  await writer.close();   // 正常关闭：flush 队列 + 发送 close 帧',
      '  await writer.abort(reason); // 异常中止：丢弃队列 + 触发 closed reject',
      '',
      '【与传统 ws.send(bufferedAmount) 的对比】',
      '  // 传统：轮询 bufferedAmount，手动 setTimeout 节流，不精确',
      '  function sendWithBackpressure(ws, chunks) {',
      '    let i = 0;',
      '    function step() {',
      '      while (i < chunks.length && ws.bufferedAmount < THRESHOLD) {',
      '        ws.send(chunks[i++]);',
      '      }',
      '      if (i < chunks.length) setTimeout(step, 10);',
      '    }',
      '    step();',
      '  }',
      '',
      '  // WebSocketStream：原生 Promise 背压，无需轮询',
      '  for (const chunk of chunks) {',
      '    await writer.ready;',
      '    await writer.write(chunk);',
      '  }',
      '',
      '【浏览器支持】',
      `  WebSocketStream: ${f.webSocketStream ? '✓' : '✗'}`,
      `  WritableStream: ${f.writableStream ? '✓' : '✗'}`,
      `  ByteLengthQueuingStrategy: ${f.byteLengthQueuingStrategy ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 不 await writer.ready 直接连续 write，会绕过背压撑爆内部队列',
      '  2. write 的 chunk 必须是 BufferSource，string 需先 TextEncoder.encode',
      '  3. desiredSize 在 close/abort 后为 null，需先判空',
      '  4. writer 持有锁，未 releaseLock 不能再 getWriter()',
      '  5. close() 是 Promise，不 await 可能丢失末尾数据',
    ].join('\n');
    this.setState({ writeInfo: info });
    this._addLog('wss', 'writable 写入与背压 API 演示完成（启动纯 JS 背压模拟见下方）');
    // 启动纯 JS 背压模拟（无需网络与 Streams，直观演示 writer.ready 自适应降速）
    this._runBackpressureSim();
  }

  // —— 纯 JS 背压模拟：生产者快速 push，消费者慢速 drain，highWaterMark 触发降速 ——
  _runBackpressureSim() {
    this._stopSim();
    const sim = { stopped: false, producerTimer: null, consumerTimer: null, reportTimer: null };
    this._sim = sim;
    this.setState({ simRunning: true, simStats: '模拟启动中…' });

    let produced = 0;
    let consumed = 0;
    let maxDepth = 0;
    let bpEvents = 0;
    let bpActive = false;
    const queue = [];
    const HIGH = 10;          // highWaterMark：触发背压的队列阈值
    const LOW = 3;            // 解除背压的低水位
    let producerRate = 1;     // 生产者每帧间隔(ms)，初始快速
    const consumerRate = 5;   // 消费者每帧间隔(ms)，慢于生产者
    const start = Date.now();

    const scheduleProducer = () => {
      if (sim.stopped) return;
      sim.producerTimer = setTimeout(produce, producerRate);
    };
    const produce = () => {
      if (sim.stopped) return;
      // —— 背压判定：等效于 writer.desiredSize <= 0 时 await writer.ready ——
      if (queue.length >= HIGH && !bpActive) {
        bpActive = true;
        bpEvents++;
        producerRate = 12; // 等效生产者 await writer.ready 挂起，降速
        this._addLog('warn', `背压触发 queue=${queue.length}≥${HIGH}，生产者降速至 ${producerRate}ms/帧（等效 await writer.ready）`);
      } else if (queue.length <= LOW && bpActive) {
        bpActive = false;
        producerRate = 1; // 下游消费追上，恢复全速
        this._addLog('info', `背压解除 queue=${queue.length}≤${LOW}，生产者恢复 ${producerRate}ms/帧`);
      }
      queue.push(produced++);
      if (queue.length > maxDepth) maxDepth = queue.length;
      scheduleProducer();
    };
    const scheduleConsumer = () => {
      if (sim.stopped) return;
      sim.consumerTimer = setTimeout(consume, consumerRate);
    };
    const consume = () => {
      if (sim.stopped) return;
      if (queue.length > 0) {
        queue.shift();
        consumed++;
      }
      scheduleConsumer();
    };
    const report = () => {
      if (sim.stopped) return;
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const depth = queue.length;
      const pct = Math.min(100, Math.round((depth / (HIGH * 2)) * 100));
      const stats = [
        `t=${elapsed}s | 生产=${produced} 消费=${consumed} 队列=${depth} 峰值=${maxDepth} 背压事件=${bpEvents}`,
        `水位 ${depth}/${HIGH*2} (${pct}%) | ${bpActive ? '⚠ 背压中（生产者 await writer.ready）' : '✓ 正常（全速生产）'}`,
      ].join('\n');
      this.setState({ simStats: stats, _simPct: pct, _simBpActive: bpActive, _simDepth: depth, _simHigh: HIGH });
      if (produced >= 200) {
        this._addLog('info', `背压模拟结束：生产=${produced} 消费=${consumed} 峰值队列=${maxDepth} 背压事件=${bpEvents}（直观演示 writer.ready 自适应降速机制）`);
        this.setState({ simRunning: false });
        this._stopSim();
        return;
      }
      sim.reportTimer = setTimeout(report, 200);
    };

    scheduleProducer();
    scheduleConsumer();
    sim.reportTimer = setTimeout(report, 200);
    this._addLog('info', '背压模拟启动：生产者 1ms/帧，消费者 5ms/帧，highWaterMark=10（纯 JS 模拟，无需网络）');
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const pct = s._simPct || 0;
    const bpActive = !!s._simBpActive;
    const depth = s._simDepth || 0;
    const high = s._simHigh || 10;
    const card = new Card({
      title: '4. writable 写入与背压 —— writer.ready / write / highWaterMark 策略',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['WritableStream', f.writableStream],
          ['ByteLengthQS', f.byteLengthQueuingStrategy],
        ]),
        h(Tag, { color: 'primary' }, '背压'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'writable.getWriter() 拿 writer，await writer.ready 感知下游消费速率（背压核心），await writer.write(chunk) 写入。highWaterMark + ByteLengthQueuingStrategy 决定 desiredSize 何时 ≤0 触发背压（writer.ready 保持 pending，生产者自然挂起）。对比传统 ws.send 仅能轮询 bufferedAmount。下方纯 JS 模拟直观演示生产者全速→队列达 highWaterMark→降速→消费追上→恢复全速的背压闭环。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行写入与背压演示', { type: 'primary', size: 'sm', onClick: () => this._runWriteDemo() }),
          s.simRunning
            ? this._btn('停止背压模拟', { type: 'danger', size: 'sm', onClick: () => { this._stopSim(); this.setState({ simRunning: false }); this._addLog('warn', '背压模拟已手动停止'); } })
            : this._btn('单独重跑背压模拟', { size: 'sm', onClick: () => this._runBackpressureSim() }),
        ),
        // 背压可视化：队列水位条 + highWaterMark 阈值线
        h('div', { class: 'wss-sim' },
          h('div', {}, s.simStats || '（点击「运行写入与背压演示」启动纯 JS 背压模拟）'),
          h('div', { class: 'wss-sim-bar-wrap' },
            h('div', { class: 'wss-sim-bar', style: { width: `${pct}%`, background: bpActive ? '#ef4444' : 'linear-gradient(90deg, #22c55e, #eab308)' } }),
            h('div', { class: 'wss-sim-threshold', style: { left: `${Math.round((high / (high * 2)) * 100)}%` } }),
          ),
          h('div', { style: { marginTop: '6px', fontSize: '11px', color: '#94a3b8' } },
            `队列水位 ${depth} / ${high * 2}（阈值 highWaterMark=${high}，超过则生产者 await writer.ready 降速）`),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const { writable } = await wss.opened;
const writer = writable.getWriter();

// —— 背压核心：await writer.ready 感知下游消费速率 ——
async function pump(chunks) {
  for (const chunk of chunks) {
    await writer.ready;            // ← 背压点：下游满则挂起
    await writer.write(chunk);     // chunk: Uint8Array
  }
  await writer.close();
}

// —— desiredSize 判断 + ByteLengthQueuingStrategy ——
const strategy = new ByteLengthQueuingStrategy({
  highWaterMark: 64 * 1024, // 64KB
});
// writer.desiredSize = highWaterMark - queuedBytes
// desiredSize <= 0 时 writer.ready 保持 pending → 全链路背压

// —— 对比传统 WebSocket：只能轮询 bufferedAmount ——
function legacySend(ws, chunks) {
  let i = 0;
  const step = () => {
    while (i < chunks.length && ws.bufferedAmount < 65536) {
      ws.send(chunks[i++]); // 不精确，无 Promise 阻塞
    }
    if (i < chunks.length) setTimeout(step, 10);
  };
  step();
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.writeInfo || '（点击按钮查看 writable 写入与背压完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：二进制类型与协议扩展 =====================

  _runBinaryDemo() {
    const f = this._flags();
    this._injectStyle('wss-binary-demo', `
      .wss-binary-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webSocketStream) {
      this._addLog('warn', 'WebSocketStream 不可用，二进制类型与协议扩展仅展示说明（jsdom 无此 API）');
    }
    const info = [
      '===== 二进制类型与协议扩展：binaryType + permessage-deflate =====',
      '',
      '【传统 WebSocket 的 binaryType】',
      '  const ws = new WebSocket(url);',
      '  ws.binaryType = "arraybuffer";  // 或 "blob"（默认）',
      '  ws.onmessage = (e) => {',
      '    // e.data: ArrayBuffer（若设 arraybuffer）或 Blob（默认）',
      '  };',
      '',
      '  - "blob"：默认，返回 Blob，需 await blob.arrayBuffer() 才能取字节',
      '  - "arraybuffer"：直接返回 ArrayBuffer，性能更好',
      '  - 不设 binaryType 则二进制消息拿到 Blob，常被新手忽略',
      '',
      '【WebSocketStream 的简化：恒为 Uint8Array】',
      '  // WebSocketStream 的 readable 流 chunk 恒为 Uint8Array',
      '  // 无需 binaryType 属性，无需 Blob/arraybuffer 切换',
      '  const { readable } = await wss.opened;',
      '  const reader = readable.getReader();',
      '  const { value } = await reader.read();',
      '  // value: Uint8Array —— 直接可操作的字节视图',
      '  console.log(value.byteLength, value.buffer);',
      '',
      '  优势：',
      '  ✓ 无 binaryType 配置陷阱（不会误拿 Blob）',
      '  ✓ Uint8Array 可直接传 WebCrypto / WebCodecs / TextDecoder',
      '  ✓ 与 BYOB reader 天然契合（零拷贝）',
      '',
      '【文本与二进制的统一处理】',
      '  // WebSocket 帧有 opcode：0x1 文本 / 0x2 二进制 / 0x8 关闭 / 0x9 ping / 0xA pong',
      '  // WebSocketStream 将文本帧也以 Uint8Array 交付，需 TextDecoder 解码',
      '  const decoder = new TextDecoder("utf-8");',
      '  const reader = readable.getReader();',
      '  while (true) {',
      '    const { value, done } = await reader.read();',
      '    if (done) break;',
      '    // 无法从 chunk 区分文本/二进制，需上层协议自描述（如 JSON vs Protobuf）',
      '  }',
      '',
      '【permessage-deflate 扩展（RFC 7692）】',
      '  // WebSocket 协议扩展，对每条消息做 zlib/deflate 压缩',
      '  // 握手阶段通过 Sec-WebSocket-Extensions 头协商',
      '',
      '  客户端请求头：',
      '    GET /stream HTTP/1.1',
      '    Upgrade: websocket',
      '    Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits',
      '',
      '  服务端响应（若同意）：',
      '    HTTP/1.1 101 Switching Protocols',
      '    Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits=15',
      '',
      '  协商参数：',
      '    client_max_window_bits  客户端→服务端方向最大滑动窗口(9-15)',
      '    server_max_window_bits  服务端→客户端方向最大滑动窗口(9-15)',
      '    client_no_context_takeover  客户端不复用压缩上下文（省内存）',
      '    server_no_context_takeover  服务端不复用压缩上下文',
      '',
      '【WebSocketStream 中查询协商结果】',
      '  const { extensions, protocol } = await wss.opened;',
      '  // extensions: string，如 "permessage-deflate; client_max_window_bits"',
      '  // protocol:  string，协商成功的子协议',
      '  console.log("扩展:", extensions);',
      '',
      '  注意：WebSocketStream 不暴露 permessage-deflate 的开关参数，',
      '  扩展协商由浏览器与服务端自动完成，开发者只能读取结果字符串。',
      '',
      '【permessage-deflate 的取舍】',
      '  ✓ 收益：',
      '    - 文本/JSON 消息压缩率高（3-10 倍），节省带宽',
      '    - 对高频小消息（如行情 tick）也有可观压缩',
      '  ✗ 代价：',
      '    - 压缩/解压占用 CPU，可能增加延迟（对低延迟行情反而有害）',
      '    - 维护 zlib 上下文占用内存（context takeover）',
      '    - 与 TLS 一起叠加，CPU 成本上升',
      '  建议：',
      '    - 文本协议（JSON）开启 permessage-deflate',
      '    - 已压缩二进制（Protobuf / 原始二进制行情）关闭，避免双压缩',
      '',
      '【Sec-WebSocket-Extensions vs Sec-WebSocket-Protocol】',
      '  Sec-WebSocket-Protocol:    子协议（应用层语义，如 "chat"）',
      '  Sec-WebSocket-Extensions:  扩展（传输层增强，如 permessage-deflate）',
      '  WebSocketStream opened 分别返回 protocol 与 extensions 字符串',
      '',
      '【其他常见扩展】',
      '  - permessage-deflate（RFC 7692）：消息压缩，最常见',
      '  - client_max_window_bits：deflate 窗口协商',
      '  - 自定义扩展（罕见）：如帧级加密、流量整形',
      '',
      '【浏览器支持】',
      `  WebSocketStream: ${f.webSocketStream ? '✓' : '✗'}`,
      `  WebSocket(binaryType): ${f.webSocket ? '✓' : '✗'}`,
      '  permessage-deflate：Chrome/Firefox 默认开启，Safari 部分支持',
      '',
      '【常见陷阱】',
      '  1. 传统 WebSocket 不设 binaryType 拿到 Blob，需额外转换',
      '  2. WebSocketStream chunk 恒 Uint8Array，文本必须 TextDecoder',
      '  3. permessage-deflate 对已压缩数据（如 gzip 包）是负优化',
      '  4. extensions 字符串需自行解析（无结构化 API）',
      '  5. no_context_takeover 会降低压缩率但省内存，高频场景权衡',
    ].join('\n');
    this.setState({ binaryInfo: info });
    this._addLog('wss', '二进制类型与 permessage-deflate 协议扩展演示完成');
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 二进制类型与协议扩展 —— binaryType + permessage-deflate + Sec-WebSocket-Extensions',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['WebSocketStream', f.webSocketStream],
          ['WebSocket', f.webSocket],
        ]),
        h(Tag, { color: 'primary' }, '协议'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '传统 WebSocket 需手动设 binaryType:"arraybuffer" 否则拿 Blob；WebSocketStream 简化为恒 Uint8Array，文本帧也需 TextDecoder 解码。permessage-deflate（RFC 7692）通过 Sec-WebSocket-Extensions 头协商消息压缩，opened 解析的 extensions 字符串可查询协商结果。文本/JSON 开启压缩收益大，已压缩二进制（Protobuf/原始行情）应关闭避免双压缩。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行协议扩展演示', { type: 'primary', size: 'sm', onClick: () => this._runBinaryDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 传统 WebSocket：必须设 binaryType
const ws = new WebSocket('wss://example.com/s');
ws.binaryType = 'arraybuffer'; // 否则拿到 Blob
ws.onmessage = (e) => { /* e.data: ArrayBuffer */ };

// WebSocketStream：恒 Uint8Array，无 binaryType
const { readable, extensions } = await wss.opened;
console.log('协商扩展:', extensions);
// "permessage-deflate; client_max_window_bits"
const reader = readable.getReader();
const decoder = new TextDecoder('utf-8');
const { value } = await reader.read();
const text = decoder.decode(value); // Uint8Array → string

// 握手头（浏览器自动处理，开发者只读结果）
// Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
// Sec-WebSocket-Protocol: chat`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.binaryInfo || '（点击按钮查看二进制类型与 permessage-deflate 完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：AbortSignal 中止与关闭握手 =====================

  _runAbortDemo() {
    const f = this._flags();
    this._injectStyle('wss-abort-demo', `
      .wss-abort-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webSocketStream) {
      this._addLog('warn', 'WebSocketStream 不可用，AbortSignal 中止仅展示 API 用法（jsdom 无此 API）');
    }
    // 本地演示 AbortController 触发 signal.aborted（纯 JS，无需网络）
    if (f.abortController) {
      try {
        const ac = new AbortController();
        const onAbort = () => this._addLog('info', `AbortSignal 触发：ac.signal.aborted=${ac.signal.aborted}（演示中止语义）`);
        ac.signal.addEventListener('abort', onAbort, { once: true });
        setTimeout(() => ac.abort(new DOMException('用户取消', 'AbortError')), 50);
      } catch (err) {
        this._addLog('warn', `AbortController 演示失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'AbortController 不可用，跳过本地中止模拟');
    }
    const info = [
      '===== AbortSignal 中止与关闭握手 =====',
      '',
      '【构造时传入 AbortSignal】',
      '  const ac = new AbortController();',
      '  const wss = new WebSocketStream(url, { signal: ac.signal });',
      '',
      '  // 任意时刻可中止连接（无论握手前/中/后）',
      '  ac.abort(new DOMException("用户取消", "AbortError"));',
      '',
      '【中止的语义】',
      '  - 握手阶段 abort：opened reject，DOMException name="AbortError"',
      '  - 已连接后 abort：底层 TCP 立即关闭（不发 close 帧），closed reject',
      '  - signal.reason 作为 abort 原因，可在 catch 中读取',
      '',
      '  try {',
      '    const { readable } = await wss.opened;',
      '    // ... 读写',
      '  } catch (err) {',
      '    if (err.name === "AbortError") console.log("用户主动中止");',
      '  }',
      '',
      '【正常关闭握手：wss.close(code, reason)】',
      '  // 主动发起关闭握手，发送 close 帧（opcode 0x8）',
      '  wss.close(1000, "正常关闭");',
      '  // close code 范围 1000/1001/3000-4999（1000 正常 / 1001 离开 / 4xxx 应用自定义）',
      '',
      '【closed Promise 解析关闭结果】',
      '  const { closeCode, reason } = await wss.closed;',
      '  console.log(`关闭 code=${closeCode} reason=${reason}`);',
      '',
      '  // 注：Explainer 中字段为 closeCode（部分早期文档记作 code）',
      '  //   1000 正常关闭',
      '  //   1001 端点离开（如关页）',
      '  //   1002 协议错误',
      '  //   1003 不支持的数据类型',
      '  //   1006 异常关闭（无 close 帧，保留值）',
      '  //   1007 数据格式错误（非 UTF-8）',
      '  //   1008 策略违反',
      '  //   1009 消息过大',
      '  //   1011 内部错误',
      '  //   4xxx 应用自定义',
      '',
      '【中止 vs 正常关闭 vs 异常】',
      '  场景              触发方式              closed 结果',
      '  ----------------------------------------------------------------',
      '  正常关闭          wss.close(1000, ...)  resolve { closeCode:1000, reason }',
      '  对端关闭          对端发 close 帧       resolve { closeCode, reason }',
      '  主动中止          ac.abort(...)         reject AbortError',
      '  网络异常          TCP 断开              reject NetworkError',
      '  协议错误          握手失败              opened reject（closed 不 resolve）',
      '',
      '【完整生命周期 + 中止示例】',
      '  const ac = new AbortController();',
      '  const wss = new WebSocketStream(url, { signal: ac.signal });',
      '',
      '  // 5 秒后若未完成则中止',
      '  const timeout = setTimeout(() => ac.abort(new DOMException("超时", "AbortError")), 5000);',
      '',
      '  try {',
      '    const { readable, writable } = await wss.opened;',
      '    clearTimeout(timeout);',
      '    // ... 业务读写',
      '    wss.close(1000, "完成");',
      '  } catch (err) {',
      '    console.error("失败/中止:", err.name, err.message);',
      '  } finally {',
      '    const { closeCode, reason } = await wss.closed.catch(() => ({ closeCode: -1, reason: "aborted" }));',
      '    console.log("最终关闭:", closeCode, reason);',
      '  }',
      '',
      '【与 fetch AbortSignal 的一致性】',
      '  WebSocketStream 的 signal 与 fetch(url, { signal }) 语义一致：',
      '  - 同一 AbortController 可控多个异步操作（fetch + WebSocketStream）',
      '  - signal.aborted 为 true 后再构造直接 reject',
      '  - signal.reason 传递中止原因（DOMException）',
      '',
      '【传统 WebSocket 的关闭对比】',
      '  // 传统 WebSocket 无 AbortSignal，只能 ws.close(code, reason)',
      '  ws.close(1000, "正常关闭");',
      '  ws.onclose = (e) => {',
      '    console.log(e.code, e.reason, e.wasClean); // CloseEvent',
      '  };',
      '  // 无法在握手阶段中止，只能等 onopen 后 close',
      '',
      '【浏览器支持】',
      `  WebSocketStream: ${f.webSocketStream ? '✓' : '✗'}`,
      `  AbortController: ${f.abortController ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. signal 已 aborted 后再 new WebSocketStream，opened 立即 reject',
      '  2. abort 不发 close 帧，对端可能误判异常；优雅关闭用 wss.close()',
      '  3. closed 字段 closeCode 与 CloseEvent.code 取值范围一致（1000-4999）',
      '  4. 1006 是保留值（异常无 close 帧），不能主动 close(1006)',
      '  5. reason 最大 123 字节（UTF-8），超长会被截断或报错',
    ].join('\n');
    this.setState({ abortInfo: info });
    this._addLog('wss', 'AbortSignal 中止与关闭握手演示完成（含本地 AbortController abort 触发模拟）');
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. AbortSignal 中止与关闭握手 —— signal + close(code, reason) + closed Promise',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['WebSocketStream', f.webSocketStream],
          ['AbortController', f.abortController],
        ]),
        h(Tag, { color: 'primary' }, '中止'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new WebSocketStream(url, { signal: ac.signal }) 传入 AbortController 信号，任意时刻 ac.abort(reason) 中止（握手阶段 opened reject AbortError，已连接后 TCP 立即关闭不发 close 帧）。正常关闭用 wss.close(1000, reason) 发起关闭握手，closed Promise 解析 { closeCode, reason }（字段名 closeCode，部分文档记作 code）。与 fetch AbortSignal 语义一致，可共享同一 AbortController。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行中止与关闭演示', { type: 'primary', size: 'sm', onClick: () => this._runAbortDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const ac = new AbortController();
const wss = new WebSocketStream('wss://example.com/s', {
  signal: ac.signal,
});

// 超时自动中止
setTimeout(() => ac.abort(new DOMException('超时', 'AbortError')), 5000);

try {
  const { readable, writable } = await wss.opened;
  // ... 读写业务
  wss.close(1000, '完成'); // 主动关闭握手
} catch (err) {
  if (err.name === 'AbortError') console.log('用户中止');
}

// closed 解析关闭结果（字段 closeCode，部分文档记作 code）
const { closeCode, reason } = await wss.closed
  .catch(() => ({ closeCode: -1, reason: 'aborted' }));
console.log('关闭 code=%d reason=%s', closeCode, reason);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.abortInfo || '（点击按钮查看 AbortSignal 中止与关闭握手完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：实战：低延迟行情推送 =====================

  _runMarketDemo() {
    const f = this._flags();
    this._injectStyle('wss-market-demo', `
      .wss-market-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webSocketStream) {
      this._addLog('warn', 'WebSocketStream 不可用，低延迟行情实战仅展示模式（jsdom 无此 API，真实 Chrome 需 wss 行情服务端）');
    }
    const info = [
      '===== 实战：低延迟行情推送（背压自适应降速 + 慢客户端检测 + 重连）=====',
      '',
      '【场景特征】',
      '  - 服务端高频推送二进制行情 tick（如 1000~10000 帧/秒）',
      '  - 每帧小（几十~几百字节），Protobuf 或自定义二进制编码',
      '  - 客户端需实时渲染 K 线/深度图，处理慢则积压',
      '  - 必须感知背压，否则内存爆掉 + 行情延迟越拉越大',
      '',
      '【WebSocketStream 背压自适应降速】',
      '  async function consumeQuotes(wss) {',
      '    const { readable } = await wss.opened;',
      '    const reader = readable.getReader();',
      '    while (true) {',
      '      const { value, done } = await reader.read();  // ← 背压点',
      '      if (done) break;',
      '      // value: Uint8Array 行情 tick',
      '      renderTick(decodeTick(value));',
      '      // 渲染慢时 reader.read() 挂起 → TCP 接收窗口收缩 → 服务端降速',
      '    }',
      '  }',
      '',
      '  // 服务端配合：感知 TCP 背压后自适应降速（丢弃过期 tick / 降低推送频率）',
      '  // 客户端无需任何额外代码，背压通过 Streams 自动传导。',
      '',
      '【慢客户端检测（结合 desiredSize / 处理耗时）】',
      '  let lastTickTs = 0;',
      '  let slowCount = 0;',
      '  const reader = readable.getReader();',
      '  while (true) {',
      '    const { value, done } = await reader.read();',
      '    if (done) break;',
      '    const now = performance.now();',
      '    const gap = now - lastTickTs;',
      '    lastTickTs = now;',
      '    const t0 = performance.now();',
      '    renderTick(decodeTick(value));',
      '    const cost = performance.now() - t0;',
      '    // 单帧处理超过 5ms 判定为慢客户端',
      '    if (cost > 5) {',
      '      slowCount++;',
      '      if (slowCount > 10) downgradeToSampling(); // 降级为采样渲染',
      '    } else {',
      '      slowCount = Math.max(0, slowCount - 1);',
      '    }',
      '  }',
      '',
      '【采样降级策略】',
      '  // 当背压持续触发时，主动丢弃非关键 tick（如只保留最新价、跳过中间深度）',
      '  let pendingTicks = [];',
      '  let flushScheduled = false;',
      '  function onTick(tick) {',
      '    pendingTicks.push(tick);',
      '    if (!flushScheduled) {',
      '      flushScheduled = true;',
      '      requestAnimationFrame(() => {',
      '        // 只渲染最新一帧，丢弃中间（rAF 自动 60fps 限速）',
      '        renderTick(pendingTicks[pendingTicks.length - 1]);',
      '        pendingTicks = [];',
      '        flushScheduled = false;',
      '      });',
      '    }',
      '  }',
      '',
      '【重连策略（指数退避 + 抖动）】',
      '  class QuoteClient {',
      '    constructor(url) { this.url = url; this.attempt = 0; }',
      '    async connect() {',
      '      const ac = new AbortController();',
      '      const wss = new WebSocketStream(this.url, { signal: ac.signal });',
      '      this._ac = ac; this._wss = wss;',
      '      try {',
      '        const { readable } = await wss.opened;',
      '        this.attempt = 0; // 重置退避',
      '        await this._pump(readable);',
      '      } catch (err) {',
      '        await this._reconnect();',
      '      }',
      '    }',
      '    async _pump(readable) {',
      '      const reader = readable.getReader();',
      '      while (true) {',
      '        const { value, done } = await reader.read();',
      '        if (done) break;',
      '        onTick(decodeTick(value));',
      '      }',
      '      await this._reconnect(); // 正常关闭也重连',
      '    }',
      '    async _reconnect() {',
      '      this.attempt++;',
      '      const base = Math.min(1000 * 2 ** this.attempt, 30000); // 指数退避上限 30s',
      '      const jitter = Math.random() * 500;                       // 抖动防雪崩',
      '      const delay = base + jitter;',
      '      console.log(`第 ${this.attempt} 次重连，${delay}ms 后`);',
      '      setTimeout(() => this.connect(), delay);',
      '    }',
      '    close() { this._ac?.abort(); }',
      '  }',
      '',
      '【心跳保活与慢死检测】',
      '  // WebSocket 长连接可能「半开」（TCP 死了但应用层不知）',
      '  // 客户端定时发 ping（应用层心跳），超时未 pong 则主动 abort 重连',
      '  let pongTimer = null;',
      '  const heartbeat = setInterval(() => {',
      '    try {',
      '      writer.write(encodePing()); // 发应用层 ping',
      '      pongTimer = setTimeout(() => ac.abort(new DOMException("心跳超时")), 5000);',
      '    } catch {}',
      '  }, 15000);',
      '',
      '  // 收到 pong 帧时 clearTimeout(pongTimer)',
      '',
      '【permessage-deflate 取舍】',
      '  - 行情 tick 通常是已压缩的二进制（Protobuf/varint），开启 permessage-deflate 反而是负优化',
      '  - 建议关闭，或仅在订阅/退订等 JSON 控制消息上享受压缩',
      '',
      '【与传统 WebSocket 行情客户端对比】',
      '  传统：必须自行轮询 bufferedAmount + setTimeout 节流，且无法精确传导到服务端',
      '  WebSocketStream：reader.read() 天然背压，TCP 窗口自动调节，服务端 send 阻塞',
      '',
      '【浏览器支持】',
      `  WebSocketStream: ${f.webSocketStream ? '✓' : '✗'}（生产需 Polyfill 降级）`,
      `  ReadableStream: ${f.readableStream ? '✓' : '✗'}`,
      `  AbortController: ${f.abortController ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 行情 tick 不要每帧 rAF，高频时合并到最新帧渲染（采样降级）',
      '  2. 重连必须指数退避 + 抖动，否则服务端恢复瞬间雪崩',
      '  3. 心跳超时阈值需大于网络 RTT 抖动上限，避免误判',
      '  4. 已压缩二进制不要叠加 permessage-deflate',
      '  5. abort 重连后需清理旧 reader/writer 引用，避免内存泄漏',
    ].join('\n');
    this.setState({ marketInfo: info });
    this._addLog('wss', '低延迟行情推送实战演示完成（背压自适应降速 + 慢客户端检测 + 重连策略）');
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战：低延迟行情推送 —— 背压自适应降速 + 慢客户端检测 + 重连策略',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['WebSocketStream', f.webSocketStream],
          ['ReadableStream', f.readableStream],
        ]),
        h(Tag, { color: 'primary' }, '实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '服务端高频二进制行情 tick（1000~10000 帧/秒），reader.read() 天然背压：渲染慢则挂起 → TCP 接收窗口收缩 → 服务端自动降速。慢客户端检测：单帧处理耗时 >5ms 累计触发采样降级（rAF 只渲染最新帧）。重连策略：指数退避 + 抖动防雪崩。心跳保活防 TCP 半开慢死。已压缩二进制（Protobuf）应关闭 permessage-deflate 避免双压缩。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行行情实战演示', { type: 'primary', size: 'sm', onClick: () => this._runMarketDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 背压自适应消费行情 tick
const { readable } = await wss.opened;
const reader = readable.getReader();
while (true) {
  const { value, done } = await reader.read(); // ← 背压点
  if (done) break;
  renderTick(decodeTick(value)); // 渲染慢则自动降速
}

// 慢客户端 → 采样降级（rAF 只渲染最新帧）
let pending = [];
let scheduled = false;
function onTick(t) {
  pending.push(t);
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(() => {
      renderTick(pending.at(-1)); // 只画最新
      pending = []; scheduled = false;
    });
  }
}

// 指数退避重连
async function reconnect() {
  this.attempt++;
  const delay = Math.min(1000 * 2 ** this.attempt, 30000) + Math.random() * 500;
  setTimeout(() => this.connect(), delay);
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.marketInfo || '（点击按钮查看低延迟行情推送实战完整方案）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：决策矩阵 + 降级 + Polyfill =====================

  _runDecisionDemo() {
    const f = this._flags();
    this._injectStyle('wss-decision-demo', `
      .wss-decision-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== vs WebSocket / WebTransport / SSE 决策矩阵 =====',
      '',
      '【6 维对比矩阵】',
      '  维度            WebSocket      WebSocketStream    WebTransport        SSE',
      '  ----------------------------------------------------------------------------------',
      '  背压            ✗ 仅 buffered  ✓ writer.ready     ✓ streams ready     ✗ 无',
      '  双向通信        ✓ 全双工       ✓ 全双工           ✓ 全双工+数据报     ✗ 单向(S→C)',
      '  可靠性          ✓ TCP 可靠     ✓ TCP 可靠         ✓ 流可靠/数据报不可靠  ✓ HTTP 可靠',
      '  低延迟          △ TCP HOL      △ TCP HOL          ✓ QUIC 0-RTT 无HOL  △ HTTP 长连',
      '  HTTP/3 多路复用 ✗ HTTP/1.1升级 ✗ HTTP/1.1升级     ✓ QUIC 原生多路     ✗ HTTP/1.1或2',
      '  二进制          ✓ 原生         ✓ Uint8Array       ✓ 原生              ✗ 仅文本(base64)',
      '',
      '  说明：',
      '  - HOL（Head-of-Line）阻塞：TCP 严格有序，前包丢失后续全等；QUIC 流间独立无 HOL',
      '  - WebTransport 数据报（datagram）不可靠但极低延迟，适合游戏/遥测',
      '  - SSE 仅服务端→客户端，二进制需 base64 编码（膨胀 33%）',
      '',
      '【选型决策树】',
      '  1. 需要 QUIC/HTTP3 多路复用 + 极低延迟 + 可容忍数据报丢包？',
      '     → WebTransport（游戏/实时协作/遥测）',
      '',
      '  2. 仅需服务端→客户端推送文本/JSON，无需双向？',
      '     → SSE（最简单，原生 EventSource，自动重连）',
      '',
      '  3. 需要全双工 + 背压 + 已有 WebSocket 服务端基础设施？',
      '     → WebSocketStream（背压敏感的高频流式场景）',
      '',
      '  4. 全双工但无背压需求 + 跨浏览器兼容性优先？',
      '     → 传统 WebSocket（最成熟，全平台支持）',
      '',
      '  5. 需要与 TransformStream/pipeTo 互操作？',
      '     → WebSocketStream 或 WebTransport（都基于 Streams）',
      '',
      '【降级方案（WebSocketStream → WebSocket Polyfill）】',
      '  // 用 WebSocket + ReadableStream/WritableStream 包装出 WebSocketStream 接口',
      '  // 背压通过 bufferedAmount 阈值模拟 writer.ready',
      '',
      '  function createWebSocketStreamPolyfill(url, { protocols, signal } = {}) {',
      '    const ws = new WebSocket(url, protocols);',
      '    ws.binaryType = "arraybuffer";',
      '',
      '    let resolveOpened, rejectOpened;',
      '    const opened = new Promise((res, rej) => { resolveOpened = res; rejectOpened = rej; });',
      '',
      '    let resolveClosed;',
      '    const closed = new Promise((res) => { resolveClosed = res; });',
      '',
      '    ws.addEventListener("open", () => {',
      '      resolveOpened({ readable, writable, protocol: ws.protocol, extensions: ws.extensions });',
      '    });',
      '    ws.addEventListener("error", () => rejectOpened(new DOMException("connect failed", "NetworkError")));',
      '    ws.addEventListener("close", (e) => resolveClosed({ closeCode: e.code, reason: e.reason }));',
      '',
      '    // readable：把 onmessage 帧灌入 ReadableStream',
      '    let controller;',
      '    const readable = new ReadableStream({',
      '      start(c) {',
      '        controller = c;',
      '        ws.addEventListener("message", (e) => c.enqueue(new Uint8Array(e.data)));',
      '        ws.addEventListener("close", () => c.close());',
      '      },',
      '      cancel() { ws.close(); }',
      '    });',
      '',
      '    // writable：用 bufferedAmount 模拟 writer.ready 背压',
      '    const HIGH_WATER = 64 * 1024;',
      '    const writable = new WritableStream({',
      '      write(chunk) {',
      '        return new Promise((resolve) => {',
      '          ws.send(chunk);',
      '          // 轮询 bufferedAmount 模拟背压（不如原生精确）',
      '          const check = () => {',
      '            if (ws.bufferedAmount < HIGH_WATER) resolve();',
      '            else setTimeout(check, 5);',
      '          };',
      '          check();',
      '        });',
      '      },',
      '      close() { ws.close(1000); }',
      '    });',
      '',
      '    if (signal) {',
      '      if (signal.aborted) rejectOpened(signal.reason);',
      '      else signal.addEventListener("abort", () => {',
      '        try { ws.close(); } catch {}',
      '        rejectOpened(signal.reason);',
      '      });',
      '    }',
      '',
      '    return { opened, closed, close: (code, reason) => ws.close(code, reason) };',
      '  }',
      '',
      '  // 用法与原生 WebSocketStream 完全一致',
      '  const WSS = typeof WebSocketStream !== "undefined" ? WebSocketStream : createWebSocketStreamPolyfill;',
      '  const wss = new WSS(url, { signal: ac.signal });',
      '  const { readable, writable } = await wss.opened;',
      '',
      '【降级到 SSE / 轮询的极简方案】',
      '  - 当 WebSocket/WebSocketStream 都不可用时：',
      '    - 服务端→客户端推送：EventSource（SSE）或 long polling',
      '    - 双向：HTTP POST + SSE 订阅（伪双工）',
      '  - 行情类场景：SSE + JSON 足够（牺牲二进制与低延迟）',
      '',
      '【Polyfill 局限】',
      '  - bufferedAmount 轮询不如原生 writer.ready 精确（毫秒级延迟）',
      '  - 无法零拷贝 BYOB（必须 new Uint8Array(e.data) 复制）',
      '  - permessage-deflate 仍由浏览器协商，Polyfill 透明',
      '  - close code/reason 通过 CloseEvent 桥接，字段名需适配',
      '',
      '【浏览器支持总览】',
      `  WebSocketStream: ${f.webSocketStream ? '✓' : '✗'}（Chrome 实验，生产需 Polyfill）`,
      `  WebSocket: ${f.webSocket ? '✓' : '✗'}（全平台成熟）`,
      `  WebTransport: ${f.webSocket ? '△' : '✗'}（Chrome/Firefox，需 HTTP/3 服务端）`,
      `  EventSource(SSE): ${f.webSocket ? '✓' : '✗'}（全平台成熟）`,
      `  ReadableStream: ${f.readableStream ? '✓' : '✗'}（Polyfill 依赖）`,
      '',
      '【常见陷阱】',
      '  1. 不要为「用新 API」而用 WebSocketStream，背压无需求时传统 WebSocket 更稳',
      '  2. WebTransport 需要 HTTP/3 服务端，部署成本高于 WebSocket',
      '  3. SSE 单向，客户端→服务端需另开 POST，不适合高频双向',
      '  4. Polyfill 的 bufferedAmount 轮询有 5ms 级延迟，实时性弱于原生',
      '  5. 降级链应按 WebSocketStream → WebSocket → SSE 顺序，逐级牺牲能力',
    ].join('\n');
    this.setState({ decisionInfo: info });
    this._addLog('wss', '决策矩阵 + 降级方案 + Polyfill 思路演示完成');
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. vs WebSocket / WebTransport / SSE 决策矩阵 + 降级方案 + Polyfill',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '决策'),
        h(Tag, { color: f.webSocketStream ? 'success' : 'error' }, `WebSocketStream ${f.webSocketStream ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '6 维对比：背压 / 双向 / 可靠 / 低延迟 / HTTP3 多路复用 / 二进制。WebSocketStream = WebSocket 背压增强版（仍 TCP/HTTP1.1 升级）；WebTransport = QUIC 原生多路 + 0-RTT + 数据报不可靠；SSE = 单向文本推送。选型决策树 + 降级链（WebSocketStream → WebSocket → SSE）。Polyfill 思路：WebSocket + ReadableStream/WritableStream + bufferedAmount 轮询模拟 writer.ready 背压，用法与原生一致。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行决策矩阵演示', { type: 'primary', size: 'sm', onClick: () => this._runDecisionDemo() }),
        ),
        // 6 维对比速查
        h('div', { class: 'wss-matrix' },
          h('div', { class: 'wss-matrix-cell' },
            h('div', { class: 'wss-matrix-title' }, 'WebSocket'),
            h('div', {}, '背压 ✗ · 双向 ✓ · 可靠 ✓ · 低延迟 △ · H3 ✗ · 二进制 ✓'),
          ),
          h('div', { class: 'wss-matrix-cell' },
            h('div', { class: 'wss-matrix-title' }, 'WebSocketStream'),
            h('div', {}, '背压 ✓ · 双向 ✓ · 可靠 ✓ · 低延迟 △ · H3 ✗ · 二进制 ✓'),
          ),
          h('div', { class: 'wss-matrix-cell' },
            h('div', { class: 'wss-matrix-title' }, 'WebTransport'),
            h('div', {}, '背压 ✓ · 双向 ✓ · 可靠 △ · 低延迟 ✓ · H3 ✓ · 二进制 ✓'),
          ),
          h('div', { class: 'wss-matrix-cell' },
            h('div', { class: 'wss-matrix-title' }, 'SSE'),
            h('div', {}, '背压 ✗ · 双向 ✗ · 可靠 ✓ · 低延迟 △ · H3 ✗ · 二进制 ✗'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// Polyfill：WebSocket + Streams 包装出 WebSocketStream 接口
function createWebSocketStreamPolyfill(url, { protocols, signal } = {}) {
  const ws = new WebSocket(url, protocols);
  ws.binaryType = 'arraybuffer';
  const opened = new Promise((res, rej) => {
    ws.addEventListener('open', () => res({
      readable, writable, protocol: ws.protocol, extensions: ws.extensions,
    }));
    ws.addEventListener('error', () => rej(new DOMException('fail', 'NetworkError')));
  });
  const closed = new Promise((res) =>
    ws.addEventListener('close', (e) => res({ closeCode: e.code, reason: e.reason })));
  // readable: onmessage → enqueue(Uint8Array)
  // writable: write → ws.send + bufferedAmount 阈值轮询模拟 writer.ready
  if (signal) signal.addEventListener('abort', () => ws.close());
  return { opened, closed, close: (c, r) => ws.close(c, r) };
}

// 用法与原生一致，自动降级
const WSS = typeof WebSocketStream !== 'undefined'
  ? WebSocketStream : createWebSocketStreamPolyfill;
const wss = new WSS(url, { signal: ac.signal });
const { readable, writable } = await wss.opened;`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.decisionInfo || '（点击按钮查看决策矩阵 + 降级方案 + Polyfill 完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== 日志面板 =====================

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

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'WebSocketStream 与 WebSocket 背压深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'WebSocketStream —— 基于 Streams API 的 WebSocket 背压封装深度实验室',
        description: '演示 WebSocketStream（Chrome 实验 origin trial，将 WebSocket 包装为 readable/writable 双向流，通过 writer.ready / reader.read() Promise 天然背压，告别传统 WebSocket 仅 bufferedAmount 轮询的事后指标）：构造与连接（new WebSocketStream(url, { protocols, signal }) + opened/closed/ready 三大 Promise + 与 new WebSocket() 的 readyState 差异 + opened 解析 { readable, writable, protocol, extensions }）、readable 流读取（getReader 默认 reader + getReader({ mode:"byob" }) BYOB reader 零拷贝 + value/done 循环 + Uint8Array 消费 + tee 分流 + pipeTo/pipeThrough 与 Streams 生态互通）、writable 写入与背压（getWriter + await writer.ready 感知下游消费速率 + await writer.write(chunk) + ByteLengthQueuingStrategy highWaterMark + desiredSize 判定 + 与 bufferedAmount 轮询对比 + 纯 JS 背压模拟）、二进制类型与协议扩展（传统 binaryType: arraybuffer/blob 陷阱 vs WebSocketStream 恒 Uint8Array 简化 + permessage-deflate RFC 7692 + Sec-WebSocket-Extensions 头协商 + opened.extensions 查询协商结果 + 文本/JSON 开启压缩 vs 已压缩二进制避免双压缩）、AbortSignal 中止与关闭握手（{ signal } 传 AbortController + ac.abort(reason) + wss.close(1000, reason) + closed Promise 解析 { closeCode, reason } + 中止/正常关闭/异常三种 closed 结果）、实战低延迟行情推送（服务端高频二进制 tick + reader.read() 天然背压自适应降速 + 慢客户端检测 + rAF 采样降级 + 指数退避重连 + 心跳保活）、vs WebSocket/WebTransport/SSE 决策矩阵（背压/双向/可靠/低延迟/HTTP3 多路复用/二进制 6 维对比 + 选型决策树 + 降级链 + Polyfill 思路）。jsdom 无 WebSocketStream 所有检测为 false，仅记日志绝不抛异常；背压机制另提供纯 JS 模拟直观演示。真实 Chrome（origin trial）可完整体验。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

      h('div', { class: 'feature-grid' },
        this._renderCard1(),
        this._renderCard2(),
        this._renderCard3(),
        this._renderCard4(),
        this._renderCard5(),
        this._renderCard6(),
        this._renderCard7(),
        this._renderCard8(),
      ),

      this._renderLogPanel(),
    ];
  }
}
