// =====================================================================
// WebTransportPage.js —— WebTransport HTTP/3 双向流 完整 实验室
// 演示 W3C WebTransport over HTTP/3（基于 QUIC）的全套能力：
//   1. 概述与动机：HTTP/3 + QUIC 基础 / WebSocket 痛点（TCP 队头阻塞、单流、
//      无不可靠模式）/ WebTransport 三种通信模式（单向流/双向流/数据报）/
//      浏览器支持 Chrome 97+ / 与 WebSocket/WebSocketStream 对比矩阵
//   2. 构造与连接：new WebTransport(url, { allowPooling, serverCertificateHashes,
//      congestionControl }) / url 必须 https 且 /_webtransport 路径 / ready Promise /
//      closed Promise / draining Promise / close({closeCode, reason}) /
//      serverCertificateHashes 自签证书
//   3. 单向流（Datagrams）：transport.datagrams.writable / maxDatagramSize /
//      writeDatagram() / 不可靠低延迟（游戏/视频帧）/ readDatagrams() /
//      与 SCTP/UDP 对比
//   4. 双向流（Bidirectional Streams）：transport.createBidirectionalStream() /
//      readable + writable / SendStream/ReceiveStream / 多路复用无队头阻塞 /
//      createUnidirectionalStream()
//   5. 单向发送/接收流：transport.createSendStream() / transport.receiveStreams() /
//      WebTransportSendStream / WebTransportReceiveStream / getStats() /
//      与 WebRTC 数据通道对比
//   6. 拥塞控制与统计：congestionControl: 'throughput'|'low-latency' / getStats()
//      返回 {bytesSent, bytesReceived, numOutgoingStreamsCreated, ...} / RTT 监控 /
//      自适应码率
//   7. 实战场景：云游戏串流 / 实时协作（Figma/Google Docs）/ 视频会议低延迟 /
//      IoT 双向遥测 / 与 WebCodecs 协同（编码后通过 datagram 发送）
//   8. 陷阱与决策矩阵：服务端需 HTTP/3 + WebTransport over HTTP/3 draft / Nginx/Node
//      实现现状 / 自签证书 serverCertificateHashes 限制 / 移动端电量消耗 /
//      降级链 WebTransport→WebSocketStream→WebSocket→SSE
// 说明：所有特性调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常。jsdom/Node 环境无 WebTransport，所有按钮点击仅展示 API 用法
//       与原理说明，不连接真实服务端。
// =====================================================================
import { Page } from '../../core/Component.js';

declare const Buffer: any;
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { State } from '../../core/types.js';

interface WebTransportPageState extends State {
  logs: any;
  capsSummary: any;
  overviewInfo: any;
  connInfo: any;
  datagramInfo: any;
  bidiInfo: any;
  unidiInfo: any;
  congestionInfo: any;
  marketInfo: any;
  decisionInfo: any;
}

export class WebTransportPage extends Page {
  declare state: WebTransportPageState;
  _dynamicStyles!: any[];
  _inited!: boolean;
  _wt!: any;

  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',       // Card 1：概述与动机
      connInfo: '',           // Card 2：构造与连接
      datagramInfo: '',       // Card 3：Datagrams 单向流
      bidiInfo: '',           // Card 4：Bidirectional Streams 双向流
      unidiInfo: '',          // Card 5：单向发送/接收流
      congestionInfo: '',     // Card 6：拥塞控制与统计
      marketInfo: '',         // Card 7：实战场景
      decisionInfo: '',       // Card 8：陷阱与决策矩阵
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];
    this._wt = null;        // 若真实环境创建过 WebTransport，销毁时关闭

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `WebTransport ${c(f.webTransport)}`,
      `'WebTransport' in window ${c(f.webTransportInWindow)}`,
      `DatagramDuplexStream ${c(f.datagramDuplexStream)}`,
      `BidirectionalStream ${c(f.bidiStream)}`,
      `SendStream ${c(f.sendStream)}`,
      `ReceiveStream ${c(f.receiveStream)}`,
    ];

    const any = f.webTransport;
    const summary = any
      ? `WebTransport 能力检测：${parts.join(' · ')}。当前环境支持 WebTransport（HTTP/3 over QUIC），可真实体验 datagrams / 双向流 / 单向流；连接需 https + /_webtransport 服务端配合。`
      : `WebTransport 能力检测：${parts.join(' · ')}。jsdom/Node 环境无 WebTransport（Chrome 97+ 支持，Firefox/Safari 部分支持），所有按钮点击仅记日志说明，绝不抛异常；真实 Chrome 可完整体验。本页另提供纯 JS 模拟演示，无需网络。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.webTransport) {
      this._addLog('warn', 'WebTransport 不可用（Chrome 97+ 支持，Firefox/Safari 部分实现，jsdom/Node 均无）');
    }
    if (!f.datagramDuplexStream) this._addLog('warn', 'WebTransportDatagramDuplexStream 不可用（datagrams API 演示跳过）');
    if (!f.bidiStream) this._addLog('warn', 'WebTransportBidirectionalStream 不可用（双向流演示跳过）');
    if (!f.sendStream) this._addLog('warn', 'WebTransportSendStream 不可用（单向发送流演示跳过）');
    if (!f.receiveStream) this._addLog('warn', 'WebTransportReceiveStream 不可用（单向接收流演示跳过）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    this._closeWt();
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 辅助方法 ——

  _addLog(type: any, content: any){
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any){
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _caps(items: any) {
    return items.map(([label, ok]: any) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _injectStyle(id: any, css: any){
    const existing = (document.getElementById(id) as any);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  _flags() {
    const safe = (fn: any) => {
      try { return fn(); } catch { return false; }
    };
    return {
      webTransport: safe(() => typeof window.WebTransport === 'function'),
      webTransportInWindow: safe(() => 'WebTransport' in window),
      datagramDuplexStream: safe(() => typeof window.WebTransportDatagramDuplexStream !== 'undefined'),
      bidiStream: safe(() => typeof window.WebTransportBidirectionalStream !== 'undefined'),
      sendStream: safe(() => typeof window.WebTransportSendStream !== 'undefined'),
      receiveStream: safe(() => typeof window.WebTransportReceiveStream !== 'undefined'),
    };
  }

  _closeWt() {
    if (this._wt) {
      try {
        this._wt.close?.({ closeCode: 1000, reason: 'component unmount' });
      } catch { /* noop */ }
      this._wt = null;
    }
  }

  _injectBaseStyles() {
    this._injectStyle('wt-base', `
      .wt-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .wt-flow {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
        font-size: 12px;
      }
      .wt-flow-node {
        padding: 4px 8px;
        border-radius: 6px;
        background: #e0e7ff;
        color: #1e40af;
        font-weight: 600;
      }
      .wt-flow-node--unreliable { background: #fee2e2; color: #991b1b; }
      .wt-flow-node--reliable { background: #dcfce7; color: #166534; }
      .wt-flow-arrow { color: #64748b; }
      .wt-matrix {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .wt-matrix-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
      }
      .wt-matrix-title { font-weight: 600; color: #1e293b; margin-bottom: 4px; }
      .wt-mode-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 10px;
      }
      .wt-mode-card {
        padding: 10px;
        border-radius: 6px;
        font-size: 12px;
      }
      .wt-mode-card--datagram { background: #fee2e2; color: #991b1b; }
      .wt-mode-card--bidi { background: #dcfce7; color: #166534; }
      .wt-mode-card--unidi { background: #dbeafe; color: #1e40af; }
      .wt-mode-title { font-weight: 600; margin-bottom: 4px; }
      .wt-output {
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
    this._injectStyle('wt-overview-demo', `
      .wt-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== WebTransport 概述与动机 =====',
      '',
      '【HTTP/3 + QUIC 基础】',
      '  HTTP/3 基于 QUIC（Quick UDP Internet Connections，Google 设计 / IETF RFC 9000）',
      '  QUIC 跑在 UDP 之上，相比 TCP 的关键优势：',
      '    ✓ 流间独立：单流丢包不阻塞其他流（无 Head-of-Line 阻塞）',
      '    ✓ 0-RTT 握手：复用连接 ID 可在首包即携带数据',
      '    ✓ 连接迁移：IP 切换（Wi-Fi→4G）不断连',
      '    ✓ 用户态实现：协议演进不依赖内核升级',
      '  HTTP/3 = HTTP/2 语义 + QUIC 传输层，使用 Alt-Svc / h3 升级',
      '',
      '【WebSocket 的痛点】',
      '  WebSocket 基于 TCP + HTTP/1.1 升级握手：',
      '  1. TCP 队头阻塞（HOL）：单 TCP 流严格有序，前包丢失后续全等',
      '     即使 WebSocket 上有 10 条独立逻辑消息，丢一包全部等待重传',
      '  2. 单流瓶颈：一条 WebSocket 连接只有一条 TCP 流，无法多路复用',
      '     多条 WebSocket 共用域名受浏览器 6 连接上限约束',
      '  3. 无不可靠模式：TCP 强制可靠 + 顺序，对实时游戏/视频帧反而有害',
      '     过期帧重传无意义，反而挤占带宽',
      '  4. 无数据报：必须以消息帧为单位，无 datagram 级别 API',
      '  5. 握手开销：HTTP/1.1 升级 + TLS 1.2 至少 2-RTT',
      '',
      '【WebTransport 三种通信模式】',
      '  1. Datagrams（数据报）：不可靠、无序、单包大小受限（≤ maxDatagramSize）',
      '     适合：游戏输入、视频帧、遥测采样',
      '     API：transport.datagrams.writable / transport.datagrams.readable',
      '',
      '  2. Bidirectional Streams（双向流）：可靠、独立流、全双工',
      '     适合：RPC、文件传输、控制信令',
      '     API：transport.createBidirectionalStream() 返回 { readable, writable }',
      '',
      '  3. Unidirectional Streams（单向流）：可靠、单方向',
      '     适合：日志上报、单向推送、流式下发',
      '     API：transport.createUnidirectionalStream() / transport.receiveStreams()',
      '',
      '  三种模式可同时存在于一条 WebTransport 连接，互不阻塞（QUIC 流独立）',
      '',
      '【浏览器支持】',
      '  Chrome：97+（2022-01）稳定支持 WebTransport over HTTP/3',
      '  Edge：97+（同 Chromium 内核）',
      '  Firefox：受限支持（需首选项 network.http.http3.enable + dom.streams.transport.enabled）',
      '  Safari：截至 2025 仍标记为 In Development',
      '  Node.js：✗ 无原生 WebTransport（需第三方 @fails-components/webtransport）',
      '  jsdom：✗ 无（本页所有检测为 false）',
      '',
      '  规范：W3C WebTransport Working Group（draft-ietf-webtrans-http3）',
      '  仍在演进，API 可能有 breaking change',
      '',
      '【WebTransport vs WebSocket vs WebSocketStream 对比矩阵】',
      '  维度              WebSocket      WebSocketStream    WebTransport',
      '  -----------------------------------------------------------------------',
      '  传输层            TCP            TCP                QUIC (UDP)',
      '  HOL 阻塞          ✓ 严重         ✓ 严重             ✗ 无（流独立）',
      '  多路复用          ✗ 单流         ✗ 单流             ✓ QUIC 原生',
      '  不可靠模式        ✗              ✗                  ✓ datagrams',
      '  双向流            ✓ 单条         ✓ 单条             ✓ 多条独立',
      '  0-RTT 握手        ✗              ✗                  ✓',
      '  连接迁移          ✗              ✗                  ✓（IP 切换不断连）',
      '  服务端依赖        HTTP/1.1 升级  HTTP/1.1 升级      HTTP/3 + WebTransport',
      '  背压              ✗ 仅 buffered  ✓ writer.ready     ✓ streams ready',
      '  成熟度            ✓ 全平台       △ Chrome 实验      △ 较新',
      '',
      '【与 WebCodecs / WebRTC 的关系】',
      '  WebTransport 解决「传输」，WebCodecs 解决「编解码」，WebRTC 是端到端方案',
      '  WebTransport + WebCodecs：可组合自定义实时媒体管线（编码后通过 datagram 发送）',
      '  WebRTC：内置 SDP 协商、ICE、STUN/TURN、媒体编解码，开箱即用但定制性差',
      '',
      '【能力检测代码】',
      "  const supported = typeof window.WebTransport === 'function';",
      "  const hasDuplex = typeof window.WebTransportDatagramDuplexStream !== 'undefined';",
      "  const hasBidi = typeof window.WebTransportBidirectionalStream !== 'undefined';",
      '',
      '【实际能力检测演示】',
      `  typeof WebTransport === 'function': ${f.webTransport ? '✓' : '✗'}`,
      `  'WebTransport' in window: ${f.webTransportInWindow ? '✓' : '✗'}`,
      `  WebTransportDatagramDuplexStream: ${f.datagramDuplexStream ? '✓' : '✗'}`,
      `  WebTransportBidirectionalStream: ${f.bidiStream ? '✓' : '✗'}`,
      `  WebTransportSendStream: ${f.sendStream ? '✓' : '✗'}`,
      `  WebTransportReceiveStream: ${f.receiveStream ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. WebTransport 仅支持 over HTTP/3，不支持 over HTTP/2（已废弃该子规范）',
      '  2. 服务端实现复杂：需 QUIC + HTTP/3 + WebTransport over HTTP/3 draft 全栈',
      '     Nginx 不支持，需 aiohttp/quic-go/Cloudflare Quiche 等专用实现',
      '  3. 自签证书需配合 serverCertificateHashes，普通自签会被拒',
      '  4. mobile 端 QUIC UDP 可能被运营商 QoS 限速或丢包（部分防火墙阻 UDP）',
      '  5. 与 WebSocket 不能互转，降级需上层抽象',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('wt', `概述演示完成：WebTransport=${f.webTransport}，datagrams/bidi/unidi 三模式`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— HTTP/3+QUIC / WebSocket 痛点 / 三通信模式 / 对比矩阵',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['WebTransport', f.webTransport],
          ['Datagram', f.datagramDuplexStream],
        ]),
        h(Tag, { color: 'primary' }, '概述'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'WebTransport over HTTP/3 基于 QUIC（UDP）解决 WebSocket 三大痛点：TCP 队头阻塞、单流瓶颈、无不可靠模式。提供三种通信模式：Datagrams（不可靠数据报，游戏/视频帧）、Bidirectional Streams（可靠双向流，RPC/文件）、Unidirectional Streams（可靠单向流，日志/推送），共享一条连接、流间互不阻塞。浏览器支持 Chrome 97+ / Edge 97+，Firefox/Safari 受限。jsdom 无此 API，仅展示用法。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行概述演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '三种通信模式速查：'),
        h('div', { class: 'wt-mode-grid' },
          h('div', { class: 'wt-mode-card wt-mode-card--datagram' },
            h('div', { class: 'wt-mode-title' }, 'Datagrams 数据报'),
            h('div', {}, '不可靠 · 无序 · ≤ maxDatagramSize\n游戏输入 / 视频帧 / 遥测'),
          ),
          h('div', { class: 'wt-mode-card wt-mode-card--bidi' },
            h('div', { class: 'wt-mode-title' }, 'Bidirectional Streams'),
            h('div', {}, '可靠 · 全双工 · 流独立\nRPC / 文件传输 / 控制信令'),
          ),
          h('div', { class: 'wt-mode-card wt-mode-card--unidi' },
            h('div', { class: 'wt-mode-title' }, 'Unidirectional Streams'),
            h('div', {}, '可靠 · 单向 · 流独立\n日志上报 / 单向推送 / 流式下发'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 连接 WebTransport（https + /_webtransport 路径）
const transport = new WebTransport('https://example.com/_webtransport');
await transport.ready;
console.log('已连接 WebTransport');

// 模式 1：Datagrams（不可靠数据报）
const writer = transport.datagrams.writable.getWriter();
await writer.write(new Uint8Array([1, 2, 3])); // 可能丢失

// 模式 2：Bidirectional Stream（可靠双向流）
const bidi = await transport.createBidirectionalStream();
const r = bidi.readable.getReader();
const w = bidi.writable.getWriter();
await w.write(new TextEncoder().encode('hello'));
const { value } = await r.read(); // 对端响应

// 模式 3：Unidirectional Stream（可靠单向流）
const uni = await transport.createUnidirectionalStream();
const uw = uni.getWriter();
await uw.write(new TextEncoder().encode('log entry'));

// 关闭
transport.close({ closeCode: 1000, reason: 'done' });`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 WebTransport 概述与动机完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：构造与连接 =====================

  _runConnDemo() {
    const f = this._flags();
    this._injectStyle('wt-conn-demo', `
      .wt-conn-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webTransport) {
      this._addLog('warn', 'WebTransport 不可用，跳过真实建连（jsdom 无此 API，真实 Chrome 需 https + /_webtransport 服务端配合）');
    } else {
      this._addLog('info', '检测到 WebTransport，但本页不连接真实服务，仅展示 API 用法');
    }
    const info = [
      '===== 构造与连接：new WebTransport + ready/closed/draining =====',
      '',
      '【构造签名】',
      '  new WebTransport(url, options?)',
      '',
      '  参数：',
      '    url       string —— 必须 https:// 且路径常为 /_webtransport（约定）',
      '                       明文 http:// 仅 localhost 可用（开发期）',
      '    options   object —— 可选',
      '      allowPooling: boolean',
      '        是否允许连接池共享（同源多条 WebTransport 复用 QUIC 连接），默认 false',
      '        true 节省握手开销，但失去独立的拥塞控制/优先级',
      '      serverCertificateHashes: Array<{ algorithm: "sha-256", value: BufferSource }>',
      '        自签证书指纹白名单，绕过 CA 链校验',
      '        仅在开发/内网自签场景使用，生产应走正规 CA',
      '        algorithm 恒为 "sha-256"，value 为 DER 证书的 SHA-256 哈希',
      '      congestionControl: "throughput" | "low-latency"',
      '        拥塞控制算法倾向：throughput 适合大文件，low-latency 适合实时',
      '        默认 "throughput"',
      '      requireUnreliable: boolean',
      '        要求底层支持不可靠传输（datagrams），不可用则构造失败',
      '',
      '【构造示例】',
      '  // 标准连接（正规 CA 证书）',
      '  const t1 = new WebTransport("https://example.com/_webtransport");',
      '',
      '  // 自签证书（开发期）',
      '  const t2 = new WebTransport("https://localhost:4433/_webtransport", {',
      '    serverCertificateHashes: [{',
      '      algorithm: "sha-256",',
      '      value: hexToBuffer("ab cd ef ... 32 字节 SHA-256"),',
      '    }],',
      '    congestionControl: "low-latency",',
      '    allowPooling: false,',
      '  });',
      '',
      '【三大 Promise 属性】',
      '  transport.ready',
      '    连接握手完成（含 TLS + QUIC + SETTINGS）后 resolve，无返回值',
      '    reject 表示连接失败（DNS / TLS / HTTP/3 协议错误）',
      '',
      '  transport.closed',
      '    连接完全关闭后 resolve，解析 { closeCode, reason }',
      '    主动 close / 对端 close / 网络中断都会触发',
      '    异常关闭 reject（部分实现以 resolve 表达）',
      '',
      '  transport.draining',
      '    服务端发起 GOAWYE 后 resolve，提示客户端「即将关闭，停止新建流」',
      '    客户端收到 draining 后应优雅关闭：完成已有流，不再 createXxxStream',
      '    通常 followed by closed',
      '',
      '【主动关闭：close({ closeCode, reason })】',
      '  transport.close({',
      '    closeCode: 1000,           // 0-65535，应用层语义',
      '    reason: "user logout",     // UTF-8 字符串，最长 1024 字节',
      '  });',
      '',
      '  close 立即触发底层 QUIC CONNECTION_CLOSE 帧，所有流被中止',
      '',
      '【完整生命周期】',
      '  async function lifecycle() {',
      '    const t = new WebTransport("https://example.com/_webtransport");',
      '',
      '    t.ready.then(() => console.log("连接就绪"));',
      '    t.draining.then(() => console.log("服务端 draining，停止新建流"));',
      '    t.closed.then(({ closeCode, reason }: any) =>',
      '      console.log(`关闭 code=${closeCode} reason=${reason}`));',
      '',
      '    try {',
      '      await t.ready;',
      '      // ... 业务：datagrams / 双向流 / 单向流',
      '    } catch (err: any) {',
      '      console.error("连接失败:", err.name, err.message);',
      '      return;',
      '    } finally {',
      '      t.close({ closeCode: 1000, reason: "done" });',
      '    }',
      '  }',
      '',
      '【serverCertificateHashes 自签证书流程】',
      '  1. 服务端用 openssl 生成自签证书 cert.pem + key.pem',
      '  2. 计算证书 SHA-256 指纹：',
      '     openssl x509 -in cert.pem -outform der | openssl dgst -sha256 -binary',
      '  3. 将 32 字节哈希以 hex 串嵌入客户端代码',
      '  4. 构造 WebTransport 时传入 serverCertificateHashes',
      '',
      '  注意：',
      '  - serverCertificateHashes 仅允许 https（非 localhost 仍要求 https）',
      '  - 一旦传入，浏览器跳过 CA 校验，仅比对指纹 → 仅限内网/开发',
      '  - 指纹错误会以 "Warning: Possibly Unhandled Promise Rejection" 拒绝',
      '',
      '【与 WebSocket 构造对比】',
      '  WebSocket：',
      '    const ws = new WebSocket("wss://example.com/stream");',
      '    ws.onopen = ...; ws.onclose = ...; ws.readyState; // 0/1/2/3',
      '',
      '  WebTransport：',
      '    const t = new WebTransport("https://example.com/_webtransport", opts);',
      '    await t.ready;     // Promise 化',
      '    await t.closed;     // Promise 化',
      '    // 无 readyState，状态由 Promise 表达',
      '',
      '【浏览器支持】',
      `  WebTransport: ${f.webTransport ? '✓' : '✗'}（Chrome 97+）`,
      `  allowPooling: Chrome 97+`,
      `  serverCertificateHashes: Chrome 97+`,
      `  congestionControl: Chrome 110+（low-latency 调度）`,
      '',
      '【常见陷阱】',
      '  1. url 必须 https（http 仅 localhost），路径常为 /_webtransport 但非强制',
      '  2. ready 必须 await，构造后立即 datagrams 访问可能未连接',
      '  3. serverCertificateHashes 指纹错误会 reject ready（非 silent fail）',
      '  4. close 后再 createXxxStream 抛 InvalidStateError',
      '  5. 同源多条 WebTransport 默认不共用 QUIC（allowPooling:false），开销大',
    ].join('\n');
    this.setState({ connInfo: info });
    this._addLog('wt', '构造与连接演示完成：ready/closed/draining 三大 Promise + serverCertificateHashes 自签');
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. 构造与连接 —— new WebTransport + allowPooling/serverCertificateHashes/congestionControl',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['WebTransport', f.webTransport]]),
        h(Tag, { color: 'primary' }, '构造'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new WebTransport(url, { allowPooling, serverCertificateHashes, congestionControl }) 构造，url 必须 https（开发期 localhost 可 http）。三大 Promise：ready（连接就绪）、closed（关闭解析 { closeCode, reason }）、draining（服务端 GOAWYE 提示停止新建流）。主动关闭 transport.close({ closeCode, reason }) 立即发 CONNECTION_CLOSE 帧。serverCertificateHashes 允许自签证书指纹白名单（仅开发/内网）。congestionControl 选 throughput / low-latency 倾向。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行构造演示', { type: 'primary', size: 'sm', onClick: () => this._runConnDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 自签证书 + 低延迟拥塞控制
const transport = new WebTransport(
  'https://localhost:4433/_webtransport',
  {
    allowPooling: false,
    serverCertificateHashes: [{
      algorithm: 'sha-256',
      value: hexToBuffer('abcdef...32 字节 SHA-256'),
    }],
    congestionControl: 'low-latency',
  },
);

// 三大 Promise
transport.ready.then(() => console.log('就绪'));
transport.draining.then(() => console.log('服务端 draining'));
transport.closed.then(({ closeCode, reason }: any) =>
  console.log('关闭', closeCode, reason));

try {
  await transport.ready;
  // ... 业务
} catch (err: any) {
  console.error('连接失败', err.name);
} finally {
  transport.close({ closeCode: 1000, reason: 'done' });
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.connInfo || '（点击按钮查看 WebTransport 构造与连接完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：Datagrams 单向流 =====================

  _runDatagramDemo() {
    const f = this._flags();
    this._injectStyle('wt-datagram-demo', `
      .wt-datagram-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webTransport) {
      this._addLog('warn', 'WebTransport 不可用，Datagrams 演示仅展示 API 用法（jsdom 无此 API）');
    }
    const info = [
      '===== Datagrams 数据报：不可靠低延迟单向通信 =====',
      '',
      '【API 入口】',
      '  transport.datagrams: WebTransportDatagramDuplexStream',
      '    .readable: ReadableStream<Uint8Array>  对端→本端（不可靠）',
      '    .writable: WritableStream<Uint8Array>  本端→对端（不可靠）',
      '    .maxDatagramSize: number  单个 datagram 最大字节（实现决定，通常 1024~65535）',
      '',
      '【写入 datagram】',
      '  const writer = transport.datagrams.writable.getWriter();',
      '  await writer.ready;             // 背压感知',
      '  await writer.write(payload);    // payload: Uint8Array ≤ maxDatagramSize',
      '  // 注意：write resolve 仅表示「已交给 QUIC」，不保证对端收到',
      '',
      '【读取 datagram】',
      '  const reader = transport.datagrams.readable.getReader();',
      '  while (true) {',
      '    const { value, done } = await reader.read();',
      '    if (done) break;',
      '    // value: Uint8Array —— 一个完整的 datagram（边界保留）',
      '    handleDatagram(value);',
      '  }',
      '',
      '  // 也可用 readDatagrams() 别名（部分实现）',
      '',
      '【maxDatagramSize 查询】',
      '  const maxSize = transport.datagrams.maxDatagramSize;',
      '  console.log("单个 datagram 上限", maxSize, "字节");',
      '  // 超过 maxDatagramSize 的 write 会抛 InvalidStateError',
      '  if ((payload as any).byteLength > maxSize) {',
      '    // 需分片或压缩',
      '  }',
      '',
      '【不可靠语义详解】',
      '  - 丢失：网络拥塞时 QUIC 可能丢弃 datagram（不重传）',
      '  - 乱序：datagram 之间无顺序保证（不同于 stream 的严格有序）',
      '  - 重复：极少，但理论上可能（QUIC 已尽力去重）',
      '  - 边界保留：每个 write 对应一个完整的 datagram，对端 read 拿到原样',
      '',
      '  vs stream 的可靠有序：datagram 适合「过时即无价值」的数据',
      '',
      '【典型场景】',
      '  1. 游戏输入：玩家位置/动作，每帧 60Hz，丢一帧不影响下一帧',
      '  2. 视频帧：WebCodecs 编码后的 H.264/VP8 帧，过期帧重传无意义',
      '  3. 遥测采样：传感器数据流，允许少量丢失',
      '  4. 实时协作光标位置：高频低价值数据',
      '',
      '【与 SCTP / UDP 对比】',
      '  UDP（应用层不可访问）：原生不可靠，浏览器禁用',
      '  WebRTC DataChannel（SCTP over DTLS over UDP）：',
      '    - 支持可靠/不可靠模式（maxRetransmits / maxPacketLifeTime）',
      '    - 但 SCTP 协议头开销大，且需 ICE/STUN/TURN 完整 P2P 建立',
      '  WebTransport datagrams：',
      '    - 直接跑 QUIC，无需 P2P 协商',
      '    - 单连接复用多条流 + datagrams，开销低',
      '    - 仅不可靠模式（不可靠程度由 QUIC 拥塞控制决定）',
      '',
      '【完整示例：游戏输入上报 + 服务端推送】',
      '  async function gameLoop(transport) {',
      '    // —— 上行：玩家输入（datagram）——',
      '    const w = transport.datagrams.writable.getWriter();',
      '    const encoder = new TextEncoder();',
      '    function sendInput(x, y, button) {',
      '      // 50 字节 JSON 输入，60Hz 发送',
      '      w.write(encoder.encode(JSON.stringify({ x, y, button, ts: Date.now() })));',
      '    }',
      '    setInterval(() => sendInput(mouseX, mouseY, btnState), 16); // 60fps',
      '',
      '    // —— 下行：服务端世界状态快照（datagram）——',
      '    const r = transport.datagrams.readable.getReader();',
      '    while (true) {',
      '      const { value, done } = await r.read();',
      '      if (done) break;',
      '      const snapshot = JSON.parse(new TextDecoder().decode(value));',
      '      renderWorld(snapshot); // 丢包则跳过一帧，下个快照覆盖',
      '    }',
      '  }',
      '',
      '【背压与限流】',
      '  await writer.ready 同样适用：网络满时 write 会被挂起',
      '  但 datagram 不可靠，过度堆积时 QUIC 会主动丢弃（而非排队）',
      '  建议应用层自带序列号 + 时间戳，接收端去重 + 过期判定',
      '',
      '【与 WebCodecs 协同（编码后发送）】',
      '  // 编码视频帧 → datagram 发送',
      '  const encoder = new VideoEncoder({',
      '    output: (chunk: any, meta: any) => {',
      '      // chunk: EncodedVideoChunk，可能是关键帧或 P 帧',
      '      const data = new Uint8Array((chunk as any).byteLength);',
      '      chunk.copyTo(data);',
      '      // 加帧头：frameType + timestamp + sequence',
      '      const packet = packFrame(chunk.type, chunk.timestamp, data);',
      '      transport.datagrams.writable.getWriter().write(packet);',
      '    },',
      '    error: (e: any) => console.error(e),',
      '  });',
      '  encoder.configure({ codec: "vp8", width: 1280, height: 720, bitrate: 1_000_000 });',
      '',
      '  // 接收端解码：丢失 P 帧则等待下一个 I 帧',
      '',
      '【浏览器支持】',
      `  WebTransportDatagramDuplexStream: ${f.datagramDuplexStream ? '✓' : '✗'}`,
      `  WebTransport: ${f.webTransport ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. datagram 无重传，必须应用层序列号去重/补包',
      '  2. payload 超过 maxDatagramSize 直接报错，需先查询上限',
      '  3. writer.ready 在 datagram 上的语义较弱（QUIC 可能直接丢）',
      '  4. 接收端无法区分「丢失」和「未发送」，需心跳保活',
      '  5. 不要在 datagram 上传关键控制信令（应走可靠双向流）',
    ].join('\n');
    this.setState({ datagramInfo: info });
    this._addLog('wt', 'Datagrams 演示完成：不可靠低延迟数据报 + maxDatagramSize + 与 WebCodecs 协同');
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. 单向流 Datagrams —— 不可靠低延迟数据报 + maxDatagramSize + WebCodecs 协同',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['DatagramDuplex', f.datagramDuplexStream],
          ['WebTransport', f.webTransport],
        ]),
        h(Tag, { color: 'warning' }, '不可靠'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'transport.datagrams 是 WebTransportDatagramDuplexStream，含 readable + writable 双向 + maxDatagramSize 上限。Datagrams 不可靠、可能丢失/乱序，但保留消息边界（一个 write 对应一个 read）。适合游戏输入、视频帧（WebCodecs 编码后发送）、遥测采样等「过时即无价值」场景。与 WebRTC SCTP 相比无需 P2P 协商、开销更低。注意：必须应用层加序列号去重，关键控制信令应走可靠流。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Datagrams 演示', { type: 'primary', size: 'sm', onClick: () => this._runDatagramDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// Datagrams：不可靠数据报
const writer = transport.datagrams.writable.getWriter();
const reader = transport.datagrams.readable.getReader();

// 写入（不保证到达）
const maxSize = transport.datagrams.maxDatagramSize;
const payload = new Uint8Array(Math.min(1024, maxSize));
crypto.getRandomValues!(payload);
await writer.ready;
await writer.write(payload);

// 读取
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  console.log('收到 datagram', (value as any).byteLength, '字节');
}

// 与 WebCodecs 协同：编码帧 → datagram
const encoder = new VideoEncoder({
  output: (chunk: any) => {
    const data = new Uint8Array((chunk as any).byteLength);
    chunk.copyTo(data);
    transport.datagrams.writable.getWriter().write(data);
  },
  error: (e: any) => console.error(e),
});
encoder.configure({ codec: 'vp8', width: 1280, height: 720 });`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.datagramInfo || '（点击按钮查看 Datagrams 数据报完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：Bidirectional Streams 双向流 =====================

  _runBidiDemo() {
    const f = this._flags();
    this._injectStyle('wt-bidi-demo', `
      .wt-bidi-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webTransport) {
      this._addLog('warn', 'WebTransport 不可用，双向流演示仅展示 API 用法（jsdom 无此 API）');
    }
    const info = [
      '===== Bidirectional Streams 双向流：多路复用无队头阻塞 =====',
      '',
      '【创建双向流】',
      '  const bidi = await transport.createBidirectionalStream();',
      '  // bidi: WebTransportBidirectionalStream',
      '  //   .readable: WebTransportReceiveStream  对端→本端（可靠、有序）',
      '  //   .writable: WebTransportSendStream     本端→对端（可靠、有序）',
      '',
      '【写入与读取】',
      '  const writer = bidi.writable.getWriter();',
      '  const reader = bidi.readable.getReader();',
      '',
      '  await writer.ready;                    // 背压',
      '  await writer.write(new TextEncoder().encode("ping"));',
      '',
      '  const { value, done } = await reader.read();',
      '  if (!done) console.log(new TextDecoder().decode(value)); // "pong"',
      '',
      '【多流多路复用】',
      '  // 一条 WebTransport 连接可同时创建大量独立双向流（QUIC stream ID 区分）',
      '  const streams = await Promise.all([',
      '    transport.createBidirectionalStream(),',
      '    transport.createBidirectionalStream(),',
      '    transport.createBidirectionalStream(),',
      '  ]);',
      '',
      '  // 流之间互不阻塞：流 A 的丢包重传不影响流 B 的数据交付',
      '  // 这是 QUIC 相对 TCP 的核心优势（无 HOL 队头阻塞）',
      '',
      '【SendStream 与 ReceiveStream】',
      '  WebTransportSendStream（写入端）：',
      '    - getWriter() 拿 writer',
      '    - writer.ready 背压',
      '    - writer.write(chunk)',
      '    - writer.close() / writer.abort(reason)',
      '',
      '  WebTransportReceiveStream（读取端）：',
      '    - getReader() / getReader({ mode: "byob" })',
      '    - reader.read() 拿 { value: Uint8Array, done }',
      '    - reader.cancel(reason)',
      '',
      '  双向流 = SendStream + ReceiveStream 独立组合，可单端关闭一侧',
      '',
      '【创建单向流：createUnidirectionalStream()】',
      '  // 仅本端→对端，无对端→本端',
      '  const uni = await transport.createUnidirectionalStream();',
      '  // uni: WebTransportSendStream',
      '  const writer = uni.getWriter();',
      '  await writer.write(new TextEncoder().encode("log entry"));',
      '  await writer.close();',
      '',
      '  // 对端通过 transport.incomingUnidirectionalStreams 接收',
      '',
      '【典型场景】',
      '  1. RPC：每条请求/响应一条双向流，多请求并发不阻塞',
      '  2. 文件分块传输：每个分块一条流，丢包仅重传该分块',
      '  3. 控制信令：双向流承载 JSON 控制消息（可靠保证）',
      '  4. 实时协作：每个用户的光标/编辑操作一条流',
      '',
      '【RPC 示例：每请求一条流】',
      '  async function rpc(transport, method, params) {',
      '    const bidi = await transport.createBidirectionalStream();',
      '    const w = bidi.writable.getWriter();',
      '    const r = bidi.readable.getReader();',
      '    // 发请求',
      '    await w.write(encode({ method, params, id: genId() }));',
      '    // 等响应',
      '    const { value } = await r.read();',
      '    return decode(value);',
      '  }',
      '',
      '  // 并发 10 个 RPC，互不阻塞',
      '  const results = await Promise.all([',
      '    rpc(t, "getUser", { id: 1 }),',
      '    rpc(t, "getUser", { id: 2 }),',
      '    rpc(t, "getPosts", { page: 1 }),',
      '    // ...',
      '  ]);',
      '',
      '【背压如何体现】',
      '  writer.ready 在 QUIC 流控窗口满时保持 pending',
      '  对端读慢 → 接收窗口收缩 → 本端 write 阻塞',
      '  与 WebSocketStream 的 writer.ready 语义一致，但 QUIC 多流可独立背压',
      '',
      '【流关闭与中止】',
      '  // 正常关闭',
      '  await writer.close();   // 发送 STREAM FIN',
      '  await reader.closed;    // 对端 FIN 后 resolve',
      '',
      '  // 异常中止（发送 RESET_STREAM）',
      '  await writer.abort(new DOMException("cancel", "AbortError"));',
      '  // 对端 reader.read() 会 reject 或 done=true',
      '',
      '【与 HTTP/2 多路复用的区别】',
      '  HTTP/2 多路复用：跑在 TCP 上，仍有 TCP HOL 阻塞',
      '  HTTP/3 + WebTransport：跑在 QUIC 上，流间真正独立',
      '  实测：丢包率 1% 时 HTTP/2 多流吞吐下降明显，HTTP/3 几乎无影响',
      '',
      '【浏览器支持】',
      `  WebTransportBidirectionalStream: ${f.bidiStream ? '✓' : '✗'}`,
      `  createBidirectionalStream: ${f.webTransport ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 每条流有创建开销（QUIC stream ID 分配 + 流控初始化），高频小请求应复用流',
      '  2. 流未关闭会占用服务端资源，需及时 close 或 abort',
      '  3. writer.abort 发 RESET_STREAM，对端需处理 AbortError',
      '  4. BYOB reader 在 ReceiveStream 上支持，但 chunk 边界由 QUIC 帧决定',
      '  5. 流的 readable/writable 是独立锁，可分别 getReader/getWriter',
    ].join('\n');
    this.setState({ bidiInfo: info });
    this._addLog('wt', '双向流演示完成：createBidirectionalStream + SendStream/ReceiveStream + 多路复用无 HOL');
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. 双向流 Bidirectional Streams —— 多路复用无队头阻塞 + SendStream/ReceiveStream',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['BidiStream', f.bidiStream],
          ['WebTransport', f.webTransport],
        ]),
        h(Tag, { color: 'success' }, '可靠'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'transport.createBidirectionalStream() 返回 WebTransportBidirectionalStream（含 readable + writable）。一条 WebTransport 连接可并发创建大量独立双向流，QUIC 流间互不阻塞（无 HOL 队头阻塞）。SendStream 写入可靠有序，ReceiveStream 读取可靠有序。适合 RPC（每请求一流）、文件分块传输、控制信令。背压通过 writer.ready 体现（QUIC 流控）。createUnidirectionalStream() 创建单向流。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行双向流演示', { type: 'primary', size: 'sm', onClick: () => this._runBidiDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 创建双向流
const bidi = await transport.createBidirectionalStream();
const writer = bidi.writable.getWriter();
const reader = bidi.readable.getReader();

await writer.ready;
await writer.write(new TextEncoder().encode('ping'));
const { value } = await reader.read();
console.log(new TextDecoder().decode(value)); // 'pong'

// 多流并发 RPC（互不阻塞）
async function rpc(method: any,  params: any) {
  const b = await transport.createBidirectionalStream();
  const w = b.writable.getWriter();
  const r = b.readable.getReader();
  await w.write(encode({ method, params }));
  const { value } = await r.read();
  return decode(value);
}
const results = await Promise.all([
  rpc('getUser', { id: 1 }),
  rpc('getUser', { id: 2 }),
  rpc('getPosts', { page: 1 }),
]);

// 创建单向流（仅本端→对端）
const uni = await transport.createUnidirectionalStream();
await uni.getWriter().write(new TextEncoder().encode('log entry'));`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.bidiInfo || '（点击按钮查看双向流 Bidirectional Streams 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：单向发送/接收流 =====================

  _runUnidiDemo() {
    const f = this._flags();
    this._injectStyle('wt-unidi-demo', `
      .wt-unidi-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webTransport) {
      this._addLog('warn', 'WebTransport 不可用，单向流演示仅展示 API 用法（jsdom 无此 API）');
    }
    const info = [
      '===== 单向发送/接收流：createSendStream + receiveStreams + getStats =====',
      '',
      '【主动创建单向发送流】',
      '  // createUnidirectionalStream 别名 createSendStream（部分实现）',
      '  const sendStream = await transport.createUnidirectionalStream();',
      '  // sendStream: WebTransportSendStream（仅 writable，无 readable）',
      '',
      '  const writer = sendStream.getWriter();',
      '  await writer.ready;',
      '  await writer.write(chunk1);',
      '  await writer.write(chunk2);',
      '  await writer.close();  // 发送 STREAM FIN',
      '',
      '【接收对端发起的单向流】',
      '  // transport.incomingUnidirectionalStreams: ReadableStream<WebTransportReceiveStream>',
      '  const reader = transport.incomingUnidirectionalStreams.getReader();',
      '  while (true) {',
      '    const { value: receiveStream, done } = await reader.read();',
      '    if (done) break;',
      '    // receiveStream: WebTransportReceiveStream（仅 readable）',
      '    const streamReader = receiveStream.getReader();',
      '    while (true) {',
      '      const { value, done } = await streamReader.read();',
      '      if (done) break;',
      '      handleChunk(value);',
      '    }',
      '  }',
      '',
      '  // transport.receiveStreams() 是另一种 API 形态（async iterator）',
      '  // 部分实现提供，标准为 incomingUnidirectionalStreams',
      '',
      '【WebTransportSendStream 特性】',
      '  - 仅 writable，无 readable（单方向）',
      '  - getWriter() 拿 writer',
      '  - writer.ready 背压',
      '  - writer.write(chunk)',
      '  - writer.close() 发送 FIN',
      '  - writer.abort(reason) 发送 RESET_STREAM',
      '',
      '【WebTransportReceiveStream 特性】',
      '  - 仅 readable，无 writable',
      '  - getReader() / getReader({ mode: "byob" })',
      '  - reader.read()',
      '  - reader.cancel(reason)',
      '',
      '【getStats()：连接级与流级统计】',
      '  // 连接级统计',
      '  const stats = await transport.getStats();',
      '  console.log(stats);',
      '  // {',
      '  //   bytesSent: number,',
      '  //   bytesReceived: number,',
      '  //   numOutgoingStreamsCreated: number,',
      '  //   numIncomingStreamsCreated: number,',
      '  //   smoothedRtt: number,        // 平滑 RTT（毫秒）',
      '  //   rttVariation: number,       // RTT 方差',
      '  //   minRtt: number,',
      '  //   datagrams: {',
      '  //     bytesSent, bytesReceived,',
      '  //     numOutgoing, numIncoming,',
      '  //   },',
      '  // }',
      '',
      '  // 流级统计（部分实现）',
      '  const streamStats = await sendStream.getStats?.();',
      '',
      '【与 WebRTC DataChannel 对比】',
      '  维度              WebRTC DataChannel            WebTransport Unidi',
      '  ------------------------------------------------------------------------',
      '  传输              SCTP over DTLS over UDP       QUIC',
      '  建立              需 SDP 协商 + ICE/STUN/TURN   直接 https 连接',
      '  多路复用          SCTP stream ID                QUIC stream ID',
      '  可靠/不可靠       可选（maxRetransmits）        流可靠 / datagram 不可靠',
      '  P2P               ✓（NAT 穿透）                 ✗（客户端↔服务端）',
      '  浏览器支持        ✓ 全平台                      Chrome 97+',
      '  延迟              受 ICE + SCTP 影响            QUIC 0-RTT 更低',
      '  典型场景          视频会议 P2P 数据             客户端↔服务端流式',
      '',
      '【典型场景：日志上报】',
      '  // 客户端：每条日志一条单向流（轻量、可靠、有序）',
      '  async function sendLog(level, msg) {',
      '    const stream = await transport.createUnidirectionalStream();',
      '    const w = stream.getWriter();',
      '    await w.write(encode({ level, msg, ts: Date.now() }));',
      '    await w.close();',
      '  }',
      '',
      '  // 服务端：监听 incomingUnidirectionalStreams',
      '  const reader = transport.incomingUnidirectionalStreams.getReader();',
      '  while (true) {',
      '    const { value: stream, done } = await reader.read();',
      '    if (done) break;',
      '    // 并发处理每条流',
      '    handleLogStream(stream);',
      '  }',
      '',
      '【典型场景：服务端流式下发】',
      '  // 服务端推流，客户端接收',
      '  // 服务端：transport.createUnidirectionalStream() → 持续 write',
      '  // 客户端：transport.incomingUnidirectionalStreams 监听',
      '  //        每条流 chunk 顺序交付，流间独立',
      '',
      '【性能考量】',
      '  - 每条流创建有 ~1ms 开销（QUIC stream ID 分配 + 流控握手）',
      '  - 高频小消息应复用一条流（datagrams 或长生命周期双向流）',
      '  - 单向流适合「一次性大量数据」（如日志批量、文件分块）',
      '',
      '【浏览器支持】',
      `  WebTransportSendStream: ${f.sendStream ? '✓' : '✗'}`,
      `  WebTransportReceiveStream: ${f.receiveStream ? '✓' : '✗'}`,
      `  incomingUnidirectionalStreams: ${f.webTransport ? '✓' : '✗'}`,
      `  getStats(): ${f.webTransport ? '✓' : '✗'}（Chrome 110+）`,
      '',
      '【常见陷阱】',
      '  1. incomingUnidirectionalStreams 必须 getReader 后持续 read，否则流积压',
      '  2. 每条单向流应及时 close，否则服务端流控窗口耗尽',
      '  3. SendStream 仅 writable，强行读 readable 抛 TypeError',
      '  4. getStats() 是 Promise，需 await，频繁调用有性能开销',
      '  5. WebRTC DataChannel 适合 P2P，WebTransport 适合 C/S，不可互换',
    ].join('\n');
    this.setState({ unidiInfo: info });
    this._addLog('wt', '单向发送/接收流演示完成：createSendStream + incomingUnidirectionalStreams + getStats + 与 WebRTC 对比');
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 单向发送/接收流 —— createSendStream + receiveStreams + getStats + vs WebRTC',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['SendStream', f.sendStream],
          ['ReceiveStream', f.receiveStream],
        ]),
        h(Tag, { color: 'primary' }, '单向'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'transport.createUnidirectionalStream() 创建 WebTransportSendStream（仅 writable）。对端发起的单向流通过 transport.incomingUnidirectionalStreams（ReadableStream<WebTransportReceiveStream>）接收。getStats() 返回 { bytesSent, bytesReceived, numOutgoingStreamsCreated, smoothedRtt, datagrams } 连接级统计。与 WebRTC DataChannel 相比：WebTransport 走 QUIC、无需 ICE/STUN/TURN P2P 协商、客户端↔服务端 C/S 模型，更适合日志上报/服务端流式下发。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行单向流演示', { type: 'primary', size: 'sm', onClick: () => this._runUnidiDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 主动创建单向发送流
const sendStream = await transport.createUnidirectionalStream();
const writer = sendStream.getWriter();
await writer.write(encode({ level: 'info', msg: 'hello' }));
await writer.close();

// 接收对端发起的单向流
const reader = transport.incomingUnidirectionalStreams.getReader();
while (true) {
  const { value: receiveStream, done } = await reader.read();
  if (done) break;
  const r = receiveStream.getReader();
  for (;;) {
    const { value, done } = await r.read();
    if (done) break;
    handleChunk(value);
  }
}

// 连接级统计
const stats = await transport.getStats();
console.log(stats);
// { bytesSent, bytesReceived, numOutgoingStreamsCreated,
//   numIncomingStreamsCreated, smoothedRtt, rttVariation,
//   minRtt, datagrams: { bytesSent, bytesReceived, ... } }`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.unidiInfo || '（点击按钮查看单向发送/接收流完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：拥塞控制与统计 =====================

  _runCongestionDemo() {
    const f = this._flags();
    this._injectStyle('wt-congestion-demo', `
      .wt-congestion-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webTransport) {
      this._addLog('warn', 'WebTransport 不可用，拥塞控制与统计演示仅展示 API 用法');
    }
    const info = [
      '===== 拥塞控制与统计：congestionControl + getStats + RTT 监控 =====',
      '',
      '【congestionControl 选项】',
      '  new WebTransport(url, { congestionControl: "throughput" | "low-latency" })',
      '',
      '  "throughput"（默认）：',
      '    - 最大化吞吐量，适合大文件传输',
      '    - 使用 NewReno / CUBIC 等激进拥塞控制',
      '    - 缓冲较大，单包延迟可能波动',
      '',
      '  "low-latency"：',
      '    - 优化延迟，适合实时音视频/游戏',
      '    - 使用 BBRv2 / Copa 等低延迟算法',
      '    - 主动放弃部分吞吐量换取稳定低延迟',
      '    - Chrome 110+ 支持',
      '',
      '【getStats() 返回值】',
      '  const stats = await transport.getStats();',
      '  // stats: WebTransportStats',
      '  // {',
      '  //   timestamp: DOMHighResTimeStamp,        // 采样时间戳',
      '  //   bytesSent: number,                      // 累计发送字节数',
      '  //   bytesReceived: number,                  // 累计接收字节数',
      '  //   numOutgoingStreamsCreated: number,      // 已创建的出向流数',
      '  //   numIncomingStreamsCreated: number,      // 已创建的入向流数',
      '  //   smoothedRtt: number,                    // 平滑 RTT（ms）',
      '  //   rttVariation: number,                   // RTT 方差（ms）',
      '  //   minRtt: number,                         // 最小 RTT（ms）',
      '  //   datagrams: {                            // datagram 子统计',
      '  //     timestamp,',
      '  //     bytesSent,',
      '  //     bytesReceived,',
      '  //     numOutgoing,',
      '  //     numIncoming,',
      '  //   },',
      '  // }',
      '',
      '【RTT 监控】',
      '  // 周期采样 RTT，判断网络质量',
      '  async function monitorRtt(transport) {',
      '    setInterval(async () => {',
      '      const stats = await transport.getStats();',
      '      const rtt = stats.smoothedRtt;',
      '      console.log(`RTT: ${rtt}ms (var ${stats.rttVariation}ms)`);',
      '      if (rtt > 200) downgradeQuality();   // 高延迟，降低码率',
      '      if (rtt < 50) upgradeQuality();       // 低延迟，提升码率',
      '    }, 1000);',
      '  }',
      '',
      '【自适应码率】',
      '  // 视频/音频编码器根据 RTT + 丢包率动态调整',
      '  async function adaptiveBitrate(transport, encoder) {',
      '    let lastRtt = 0;',
      '    setInterval(async () => {',
      '      const s = await transport.getStats();',
      '      const rtt = s.smoothedRtt;',
      '      const lossRate = estimateLossRate(s);   // 由 bytesSent/Received 估算',
      '',
      '      // 简单 AIMD 策略',
      '      if (rtt > 200 || lossRate > 0.05) {',
      '        encoder.encodeQueueSize;',
      '        encoder.configure({ bitrate: encoder.bitrate * 0.8 }); // 降码率',
      '      } else if (rtt < 100 && lossRate < 0.01) {',
      '        encoder.configure({ bitrate: encoder.bitrate * 1.1 }); // 升码率',
      '      }',
      '      lastRtt = rtt;',
      '    }, 1000);',
      '  }',
      '',
      '【拥塞控制与 datagrams 的关系】',
      '  - datagrams 不可靠，拥塞时 QUIC 主动丢弃（不重传）',
      '  - 低延迟模式下，datagram 优先级高于 stream（避免被流控阻塞）',
      '  - 实测：low-latency 模式下视频帧端到端延迟降低 30-50%',
      '',
      '【连接池与共享拥塞控制】',
      '  allowPooling: true 时，同源多条 WebTransport 共享 QUIC 连接：',
      '    - 共享拥塞控制状态（RTT、cwnd）',
      '    - 共享流控窗口',
      '    - 节省握手开销（0-RTT 复用）',
      '  缺点：',
      '    - 单条 WebTransport 异常影响其他',
      '    - 失去独立的优先级调度',
      '',
      '【统计采样性能】',
      '  - getStats() 内部需遍历 QUIC 状态，频繁调用有开销',
      '  - 建议 1Hz 采样足够，避免每帧调用',
      '  - smoothedRtt 是 QUIC 内部维护，无需应用层计算',
      '',
      '【浏览器支持】',
      `  congestionControl "low-latency": Chrome 110+`,
      `  getStats(): Chrome 110+`,
      `  WebTransport: ${f.webTransport ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. congestionControl 仅是「倾向」，浏览器/服务端可能不严格遵守',
      '  2. getStats() 返回累计值，需自行差分计算速率',
      '  3. smoothedRtt 初始为 0（未握手完成），需 await ready 后采样',
      '  4. 自适应码率应平滑变化，避免抖动（PID 控制器更稳）',
      '  5. allowPooling 共享拥塞控制，一条慢连接拖累其他',
    ].join('\n');
    this.setState({ congestionInfo: info });
    this._addLog('wt', '拥塞控制与统计演示完成：throughput/low-latency + getStats + RTT 监控 + 自适应码率');
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 拥塞控制与统计 —— congestionControl + getStats + RTT + 自适应码率',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['WebTransport', f.webTransport]]),
        h(Tag, { color: 'primary' }, '统计'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'congestionControl 选项：throughput（默认，最大化吞吐，NewReno/CUBIC）/ low-latency（优化延迟，BBRv2/Copa，Chrome 110+）。getStats() 返回 { bytesSent, bytesReceived, numOutgoingStreamsCreated, smoothedRtt, rttVariation, minRtt, datagrams } 连接级统计。RTT 监控周期采样判断网络质量，自适应码率根据 RTT + 丢包率动态调整 WebCodecs 编码器 bitrate（AIMD 策略）。allowPooling 共享拥塞控制状态但失去独立优先级。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行拥塞控制演示', { type: 'primary', size: 'sm', onClick: () => this._runCongestionDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 低延迟拥塞控制
const transport = new WebTransport(url, {
  congestionControl: 'low-latency',
});
await transport.ready;

// RTT 监控 + 自适应码率
setInterval(async () => {
  const s = await transport.getStats();
  console.log('RTT', s.smoothedRtt, 'ms',
    'bytesSent', s.bytesSent, 'bytesRecv', s.bytesReceived);

  if (s.smoothedRtt > 200) {
    encoder.configure({ bitrate: encoder.bitrate * 0.8 }); // 降码率
  } else if (s.smoothedRtt < 100) {
    encoder.configure({ bitrate: encoder.bitrate * 1.1 }); // 升码率
  }
}, 1000);

// 完整 stats 结构
const stats = await transport.getStats();
// {
//   timestamp, bytesSent, bytesReceived,
//   numOutgoingStreamsCreated, numIncomingStreamsCreated,
//   smoothedRtt, rttVariation, minRtt,
//   datagrams: { bytesSent, bytesReceived, numOutgoing, numIncoming }
// }`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.congestionInfo || '（点击按钮查看拥塞控制与统计完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：实战场景 =====================

  _runMarketDemo() {
    const f = this._flags();
    this._injectStyle('wt-market-demo', `
      .wt-market-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.webTransport) {
      this._addLog('warn', 'WebTransport 不可用，实战场景仅展示模式（jsdom 无此 API，真实 Chrome 需 HTTP/3 服务端）');
    }
    const info = [
      '===== 实战场景：云游戏 / 实时协作 / 视频会议 / IoT / WebCodecs 协同 =====',
      '',
      '【场景 1：云游戏串流】',
      '  特征：服务端渲染 + 编码视频帧 → 客户端；客户端输入 → 服务端',
      '  极低延迟要求（<50ms 端到端），丢一帧可接受',
      '',
      '  架构：',
      '    下行（视频）：WebCodecs 编码 → datagrams（不可靠）→ 客户端解码渲染',
      '    上行（输入）：玩家操作 → datagrams（60Hz）→ 服务端应用',
      '    控制信令：双向流（可靠）承载暂停/恢复/分辨率切换',
      '',
      '  代码：',
      '    const t = new WebTransport(url, { congestionControl: "low-latency" });',
      '    await t.ready;',
      '',
      '    // —— 下行：服务端编码视频帧推流 ——',
      '    const r = t.datagrams.readable.getReader();',
      '    const decoder = new VideoDecoder({ output: renderFrame, error: console.error });',
      '    decoder.configure({ codec: "vp8", width: 1920, height: 1080 });',
      '    while (true) {',
      '      const { value, done } = await r.read();',
      '      if (done) break;',
      '      // 解析帧头：frameType + timestamp + sequence',
      '      const { frameType, ts, data } = parseFrame(value);',
      '      decoder.decode(new EncodedVideoChunk({',
      '        type: frameType,',
      '        timestamp: ts,',
      '        data,',
      '      }));',
      '    }',
      '',
      '    // —— 上行：玩家输入 60Hz ——',
      '    const w = t.datagrams.writable.getWriter();',
      '    setInterval(() => {',
      '      w.write(encodeInput({ x, y, btn, ts: performance.now() }));',
      '    }, 16);',
      '',
      '    // —— 控制信令：双向流 ——',
      '    const ctrl = await t.createBidirectionalStream();',
      '    async function sendControl(cmd) {',
      '      await ctrl.writable.getWriter().write(encode(cmd));',
      '    }',
      '',
      '【场景 2：实时协作（Figma / Google Docs 风格）】',
      '  特征：多用户编辑同一文档，光标位置 + 编辑操作高频同步',
      '  架构：',
      '    光标位置：datagrams（高频、丢一帧无妨）',
      '    编辑操作：双向流（可靠，必须送达）',
      '    文档快照：单向流（服务端推流，初次加载）',
      '',
      '  代码：',
      '    // 光标位置广播（datagrams）',
      '    function sendCursor(x, y) {',
      '      t.datagrams.writable.getWriter().write(encode({ x, y, ts: Date.now() }));',
      '    }',
      '',
      '    // 编辑操作（双向流，每用户一流）',
      '    async function sendEdit(op) {',
      '      const b = await t.createBidirectionalStream();',
      '      const w = b.writable.getWriter();',
      '      await w.write(encode(op));',
      '      await w.close();',
      '    }',
      '',
      '    // 服务端推流文档快照',
      '    const r = t.incomingUnidirectionalStreams.getReader();',
      '    while (true) {',
      '      const { value: stream, done } = await r.read();',
      '      if (done) break;',
      '      consumeSnapshot(stream);',
      '    }',
      '',
      '【场景 3：视频会议低延迟】',
      '  特征：多人会议，每路音视频流独立传输',
      '  优势 vs WebRTC：',
      '    - 服务端转码/MCU 更灵活（WebRTC 是 P2P，SFU 复杂）',
      '    - 与 WebCodecs 协同，自定义编码参数（屏幕分享用 VP9/AV1）',
      '    - QUIC 多路复用，单连接承载多路流',
      '',
      '  代码：',
      '    // 每路视频流一条双向流（流独立，互不阻塞）',
      '    async function publishStream(track) {',
      '      const b = await t.createBidirectionalStream();',
      '      const encoder = new VideoEncoder({',
      '        output: (chunk: any) => b.writable.getWriter().write(copyChunk(chunk)),',
      '        error: console.error,',
      '      });',
      '      encoder.configure({ codec: "av1", width: 1280, height: 720 });',
      '      track.onFrame = (frame: any) => encoder.encode(frame);',
      '    }',
      '',
      '【场景 4：IoT 双向遥测】',
      '  特征：设备传感器数据上报 + 服务端控制指令下发',
      '  架构：',
      '    遥测：datagrams（高频，允许丢失）',
      '    控制：双向流（可靠，必须送达）',
      '    批量日志：单向流（可靠，有序）',
      '',
      '  代码：',
      '    // 遥测上报（datagrams，1Hz~100Hz）',
      '    setInterval(() => {',
      '      t.datagrams.writable.getWriter().write(encodeSensor(reading));',
      '    }, 100);',
      '',
      '    // 控制指令接收（双向流）',
      '    const ctrl = await t.createBidirectionalStream();',
      '    const r = ctrl.readable.getReader();',
      '    while (true) {',
      '      const { value, done } = await r.read();',
      '      if (done) break;',
      '      applyCommand(decode(value));',
      '    }',
      '',
      '【场景 5：与 WebCodecs 协同（编码后通过 datagram 发送）】',
      '  // WebCodecs 编码 → WebTransport 传输',
      '  // 接收端解码 → Canvas 渲染',
      '  // 全链路无需 MediaRecorder / WebRTC，延迟可降至 50ms 以内',
      '',
      '  // 发送端',
      '  const encoder = new VideoEncoder({',
      '    output: (chunk: any, meta: any) => {',
      '      const data = new Uint8Array((chunk as any).byteLength + 16);',
      '      // 帧头：frameType(1) + timestamp(8) + sequence(4) + keyframe(1) + reserved(2)',
      '      data[0] = chunk.type === "key" ? 1 : 0;',
      '      new DataView(data.buffer).setBigUint64(1, BigInt(chunk.timestamp));',
      '      new DataView(data.buffer).setUint32(9, seq++);',
      '      data.set(new Uint8Array((chunk as any).byteLength), 16);',
      '      chunk.copyTo(data.subarray(16));',
      '      t.datagrams.writable.getWriter().write(data);',
      '    },',
      '    error: console.error,',
      '  });',
      '  encoder.configure({ codec: "vp8", width: 1280, height: 720, bitrate: 500_000 });',
      '',
      '  // 接收端',
      '  const decoder = new VideoDecoder({ output: renderFrame, error: console.error });',
      '  decoder.configure({ codec: "vp8", width: 1280, height: 720 });',
      '  const r = t.datagrams.readable.getReader();',
      '  while (true) {',
      '    const { value, done } = await r.read();',
      '    if (done) break;',
      '    const type = value[0] === 1 ? "key" : "delta";',
      '    const ts = Number(new DataView(value.buffer).getBigUint64(1));',
      '    decoder.decode(new EncodedVideoChunk({ type, timestamp: ts, data: value.subarray(16) }));',
      '  }',
      '',
      '【浏览器支持】',
      `  WebTransport: ${f.webTransport ? '✓' : '✗'}`,
      `  WebCodecs: △（Chrome/Edge 全支持，Firefox/Safari 部分支持）`,
      `  congestionControl low-latency: Chrome 110+`,
      '',
      '【常见陷阱】',
      '  1. 视频帧必须自带序列号 + 时间戳，丢帧时接收端需等下一个关键帧',
      '  2. datagram 上行 + 双向流控制并存时，注意优先级（low-latency 倾向 datagram）',
      '  3. WebCodecs 配置变更需 flush 编码器，避免丢帧',
      '  4. 多用户协作场景需服务端做 CRDT/OT 合并，WebTransport 仅传输',
      '  5. IoT 场景注意设备电量（QUIC UDP 心跳频率平衡延迟与功耗）',
    ].join('\n');
    this.setState({ marketInfo: info });
    this._addLog('wt', '实战场景演示完成：云游戏 + 实时协作 + 视频会议 + IoT + WebCodecs 协同');
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战场景 —— 云游戏 / 实时协作 / 视频会议 / IoT / WebCodecs 协同',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['WebTransport', f.webTransport]]),
        h(Tag, { color: 'primary' }, '5 大场景'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '五大实战场景：云游戏串流（WebCodecs 编码 → datagrams 下行 + 输入上行 + 双向流控制信令）、实时协作 Figma/Google Docs（光标 datagrams + 编辑双向流 + 快照单向流）、视频会议低延迟（每路视频一条双向流，vs WebRTC SFU 更灵活）、IoT 双向遥测（传感器 datagrams + 控制双向流 + 批量日志单向流）、WebCodecs 协同（编码后通过 datagram 发送，全链路延迟 <50ms）。low-latency 拥塞控制 + 多路复用是核心优势。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战场景演示', { type: 'primary', size: 'sm', onClick: () => this._runMarketDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '数据流示意：'),
        h('div', { class: 'wt-flow' },
          h('span', { class: 'wt-flow-node' }, 'WebCodecs 编码'),
          h('span', { class: 'wt-flow-arrow' }, '→'),
          h('span', { class: 'wt-flow-node wt-flow-node--unreliable' }, 'datagrams 下行'),
          h('span', { class: 'wt-flow-arrow' }, '→'),
          h('span', { class: 'wt-flow-node' }, 'WebCodecs 解码'),
          h('span', { class: 'wt-flow-arrow' }, '→'),
          h('span', { class: 'wt-flow-node' }, 'Canvas 渲染'),
        ),
        h('div', { class: 'wt-flow' },
          h('span', { class: 'wt-flow-node wt-flow-node--unreliable' }, '玩家输入 datagrams 上行'),
          h('span', { class: 'wt-flow-arrow' }, '→'),
          h('span', { class: 'wt-flow-node' }, '服务端游戏循环'),
        ),
        h('div', { class: 'wt-flow' },
          h('span', { class: 'wt-flow-node wt-flow-node--reliable' }, '控制信令 双向流'),
          h('span', { class: 'wt-flow-arrow' }, '↔'),
          h('span', { class: 'wt-flow-node wt-flow-node--reliable' }, '暂停/恢复/分辨率'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 云游戏：WebCodecs 编码 → datagrams 下行
const t = new WebTransport(url, { congestionControl: 'low-latency' });
await t.ready;

const encoder = new VideoEncoder({
  output: (chunk: any) => {
    const data = new Uint8Array((chunk as any).byteLength + 16);
    data[0] = chunk.type === 'key' ? 1 : 0;
    new DataView(data.buffer).setBigUint64(1, BigInt(chunk.timestamp));
    chunk.copyTo(data.subarray(16));
    t.datagrams.writable.getWriter().write(data);
  },
  error: console.error,
});
encoder.configure({ codec: 'vp8', width: 1920, height: 1080 });

// 接收端：datagrams → WebCodecs 解码
const r = t.datagrams.readable.getReader();
const decoder = new VideoDecoder({ output: renderFrame, error: console.error });
decoder.configure({ codec: 'vp8', width: 1920, height: 1080 });
while (true) {
  const { value, done } = await r.read();
  if (done) break;
  decoder.decode(new EncodedVideoChunk({
    type: value[0] === 1 ? 'key' : 'delta',
    timestamp: Number(new DataView(value.buffer).getBigUint64(1)),
    data: value.subarray(16),
  }));
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.marketInfo || '（点击按钮查看 5 大实战场景完整方案）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：陷阱与决策矩阵 =====================

  _runDecisionDemo() {
    const f = this._flags();
    this._injectStyle('wt-decision-demo', `
      .wt-decision-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== 陷阱与决策矩阵：服务端现状 + 证书限制 + 降级链 =====',
      '',
      '【陷阱 1：服务端实现复杂】',
      '  WebTransport 仅支持 over HTTP/3（不支持 HTTP/2 子规范，已废弃）',
      '  服务端需完整支持：',
      '    - QUIC（RFC 9000）',
      '    - HTTP/3（RFC 9114）',
      '    - WebTransport over HTTP/3（draft-ietf-webtrans-http3）',
      '    - datagrams（HTTP/3 datagram extension, RFC 9297）',
      '',
      '  现状：',
      '    Nginx：✗ 不支持（截至 2025 仍在 roadmap）',
      '    Node.js：✗ 无原生支持，需第三方包',
      '    aiohttp (Python)：△ 实验性 HTTP/3，WebTransport 不完整',
      '    Cloudflare Quiche：✓ 支持（生产可用）',
      '    quic-go (Go)：✓ 支持（devsisters/quic-go）',
      '    msquic (Microsoft, C)：✓ 支持',
      '    lsquic (LiteSpeed, C)：✓ 支持',
      '    Cloudflare Workers：✓ 通过 sockets API 间接支持',
      '',
      '【陷阱 2：自签证书 serverCertificateHashes 限制】',
      '  - 仅允许 sha-256 算法',
      '  - value 必须是 DER 证书的 SHA-256 哈希（非 PEM 文本哈希）',
      '  - 计算命令：',
      '    openssl x509 -in cert.pem -outform der | \\',
      '      openssl dgst -sha256 -binary | xxd -p -c 32',
      '  - 仅限开发/内网，生产应走正规 CA',
      '  - 指纹错误时 ready reject（无 silent fallback）',
      '',
      '【陷阱 3：移动端电量与网络】',
      '  - QUIC 跑 UDP，部分运营商/防火墙限速或丢 UDP 包',
      '    （实测某些 4G 网络下 UDP 吞吐仅为 TCP 的 50%）',
      '  - 心跳保活需平衡：太频繁耗电，太稀疏 NAT 超时',
      '  - iOS Safari 不支持（截至 2025），移动端覆盖有限',
      '  - 切换网络（Wi-Fi→4G）时 QUIC 连接迁移理论上不断连，',
      '    但部分实现仍会断',
      '',
      '【陷阱 4：QUIC UDP 被 QoS】',
      '  - 部分企业防火墙完全阻断 UDP',
      '  - 解决：服务端同时监听 TCP/443（HTTPS）+ UDP/443（HTTP/3）',
      '         客户端优先 HTTP/3，失败回退 HTTP/1.1 / WebSocket',
      '  - 浏览器自动协商（Alt-Svc 头），但 WebTransport 必须显式 HTTPS + HTTP/3',
      '',
      '【陷阱 5：与 WebSocket 不可互转】',
      '  - WebTransport 和 WebSocket 是完全独立的协议栈',
      '  - 不能在服务端「升级」WebSocket 到 WebTransport',
      '  - 降级需上层抽象（同一段应用代码用两种传输）',
      '',
      '【降级链：WebTransport → WebSocketStream → WebSocket → SSE】',
      '  const transport = await createTransport(url).catch(async (err: any) => {',
      '    console.warn("WebTransport 不可用，降级到 WebSocketStream", err);',
      '    return await createWSS(url).catch(async () => {',
      '      console.warn("WebSocketStream 不可用，降级到 WebSocket");',
      '      return await createWS(url).catch(() => {',
      '        console.warn("WebSocket 不可用，降级到 SSE");',
      '        return createSSE(url);',
      '      });',
      '    });',
      '  });',
      '',
      '  // 各级能力对比：',
      '  WebTransport：     datagrams + 双向流 + 单向流 + 0-RTT',
      '  WebSocketStream：  readable/writable 双向 + 背压',
      '  WebSocket：        onmessage 事件 + 无背压',
      '  SSE：              仅服务端→客户端文本推送',
      '',
      '  // 抽象层接口设计',
      '  class TransportAdapter {',
      '    async send(data) { /* 子类实现 */ }',
      '    onMessage(cb) { /* 子类实现 */ }',
      '    async close() { /* 子类实现 */ }',
      '  }',
      '',
      '  class WebTransportAdapter extends TransportAdapter { ... }',
      '  class WSSAdapter extends TransportAdapter { ... }',
      '  class WSAdapter extends TransportAdapter { ... }',
      '  class SSEAdapter extends TransportAdapter { ... }',
      '',
      '【6 维决策矩阵】',
      '  维度            WebTransport    WebSocketStream   WebSocket      SSE',
      '  ------------------------------------------------------------------------------',
      '  传输层          QUIC (UDP)      TCP               TCP            HTTP',
      '  HOL 阻塞        ✗ 无            ✓ 严重            ✓ 严重         ✓',
      '  多路复用        ✓ 流独立        ✗ 单流            ✗ 单流         ✗',
      '  不可靠模式      ✓ datagrams     ✗                 ✗              ✗',
      '  双向通信        ✓ 全双工+数据报 ✓ 全双工          ✓ 全双工       ✗ 单向',
      '  0-RTT 握手      ✓               ✗                 ✗              ✗',
      '  连接迁移        ✓ IP 切换不断   ✗                 ✗              ✗',
      '  背压            ✓ streams ready ✓ writer.ready    ✗              ✗',
      '  二进制          ✓ 原生          ✓ Uint8Array      ✓ binaryType   ✗ base64',
      '  服务端复杂度    ✓✓ 高           △ 低              ✓ 低           ✓ 低',
      '  浏览器支持      Chrome 97+      Chrome 实验       全平台         全平台',
      '',
      '【选型决策树】',
      '  1. 需要 QUIC 多路复用 + 不可靠 datagram + 极低延迟？',
      '     → WebTransport（云游戏/实时协作/IoT/视频会议）',
      '',
      '  2. 仅需全双工 + 背压 + 已有 WebSocket 服务端？',
      '     → WebSocketStream（高频流式 + 背压敏感）',
      '',
      '  3. 全双工 + 跨浏览器兼容性优先 + 无背压需求？',
      '     → WebSocket（最成熟）',
      '',
      '  4. 仅服务端→客户端推送文本/JSON？',
      '     → SSE（最简单，原生 EventSource）',
      '',
      '  5. 需要 0-RTT / 连接迁移（移动端弱网）？',
      '     → WebTransport（QUIC 原生）',
      '',
      '【服务端实现选型】',
      '  生产高并发：Cloudflare Quiche / Cloudflare Workers',
      '  Go 中后台：devsisters/quic-go',
      '  C/C++ 嵌入式：msquic / lsquic',
      '  Python 实验：aiohttp（不推荐生产）',
      '  Node.js：等待官方支持或用 @fails-components/webtransport',
      '',
      '【浏览器支持总览】',
      `  WebTransport: ${f.webTransport ? '✓' : '✗'}（Chrome 97+，Edge 97+，Firefox 受限，Safari In Development）`,
      `  WebSocketStream: △（Chrome 实验 origin trial）`,
      `  WebSocket: ✓（全平台成熟）`,
      `  SSE: ✓（全平台成熟）`,
      '',
      '【常见陷阱总结】',
      '  1. 不要为「用新 API」而用 WebTransport，HTTP/3 服务端部署成本高',
      '  2. UDP 在部分网络环境被限速/阻断，必须有 TCP 回退',
      '  3. datagram 不可靠，关键信令必须走可靠流',
      '  4. serverCertificateHashes 仅限开发，生产走正规 CA',
      '  5. 移动端 iOS Safari 不支持，覆盖有限',
      '  6. 降级链必须设计 TransportAdapter 抽象，否则代码侵入大',
    ].join('\n');
    this.setState({ decisionInfo: info });
    this._addLog('wt', '陷阱与决策矩阵演示完成：服务端现状 + 证书限制 + 降级链');
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 陷阱与决策矩阵 —— 服务端现状 + 证书限制 + 移动端 + 降级链',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '决策'),
        h(Tag, { color: f.webTransport ? 'success' : 'error' }, `WebTransport ${f.webTransport ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '五大陷阱：服务端实现复杂（Nginx/Node 不支持，需 Cloudflare Quiche/quic-go/msquic 等）、自签证书 serverCertificateHashes 仅 sha-256 + DER 哈希、移动端 QUIC UDP 被运营商 QoS + iOS Safari 不支持、QUIC UDP 被防火墙阻断需 TCP 回退、与 WebSocket 不可互转需 TransportAdapter 抽象降级。6 维决策矩阵：传输层/HOL/多路复用/不可靠/双向/0-RTT。降级链 WebTransport→WebSocketStream→WebSocket→SSE 逐级牺牲能力。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行决策矩阵演示', { type: 'primary', size: 'sm', onClick: () => this._runDecisionDemo() }),
        ),
        h('div', { class: 'wt-matrix' },
          h('div', { class: 'wt-matrix-cell' },
            h('div', { class: 'wt-matrix-title' }, 'WebTransport'),
            h('div', {}, 'QUIC · 无 HOL · 多路复用 · datagram · 0-RTT · Chrome 97+'),
          ),
          h('div', { class: 'wt-matrix-cell' },
            h('div', { class: 'wt-matrix-title' }, 'WebSocketStream'),
            h('div', {}, 'TCP · 有 HOL · 单流 · 背压 · Chrome 实验'),
          ),
          h('div', { class: 'wt-matrix-cell' },
            h('div', { class: 'wt-matrix-title' }, 'WebSocket'),
            h('div', {}, 'TCP · 有 HOL · 单流 · 无背压 · 全平台'),
          ),
          h('div', { class: 'wt-matrix-cell' },
            h('div', { class: 'wt-matrix-title' }, 'SSE'),
            h('div', {}, 'HTTP · 单向 · 文本 · 自动重连 · 全平台'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 降级链：WebTransport → WebSocketStream → WebSocket → SSE
async function createTransport(url: any) {
  // 1. 优先 WebTransport
  if (typeof WebTransport === 'function') {
    try {
      const t = new WebTransport(url.replace(/^ws/, 'https'));
      await t.ready;
      return new WebTransportAdapter(t);
    } catch (e: any) { console.warn('WT 失败', e); }
  }
  // 2. 降级 WebSocketStream
  if (typeof WebSocketStream !== 'undefined') {
    try {
      const wss = new WebSocketStream(url);
      const { readable, writable } = await wss.opened;
      return new WSSAdapter(readable, writable);
    } catch (e: any) { console.warn('WSS 失败', e); }
  }
  // 3. 降级 WebSocket
  if (typeof WebSocket !== 'undefined') {
    return new WSAdapter(new WebSocket(url));
  }
  // 4. 最后降级 SSE
  return new SSEAdapter(new EventSource(url + '/sse'));
}

// 抽象层统一接口
class TransportAdapter {
  async send(data: any) {
  onMessage(cb: any) {
  async close() {
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.decisionInfo || '（点击按钮查看陷阱与决策矩阵完整说明）')),
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
        ...s.logs.map((log: any) =>
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
      h('h2', { class: 'section-title' }, 'WebTransport HTTP/3 双向流深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'WebTransport —— 基于 HTTP/3 + QUIC 的下一代双向通信深度实验室',
        description: '演示 WebTransport over HTTP/3（基于 QUIC，UDP 传输，无 TCP 队头阻塞，0-RTT 握手，连接迁移）三种通信模式：Datagrams（不可靠数据报，游戏输入/视频帧/WebCodecs 协同）、Bidirectional Streams（可靠双向流，RPC/文件传输，多路复用无 HOL）、Unidirectional Streams（可靠单向流，日志上报/服务端推流）。涵盖构造与连接（new WebTransport + allowPooling/serverCertificateHashes/congestionControl + ready/closed/draining 三大 Promise + 自签证书指纹流程）、Datagrams API（datagrams.writable/readable + maxDatagramSize + 不可靠语义 + 与 SCTP/UDP 对比 + WebCodecs 协同）、双向流（createBidirectionalStream + SendStream/ReceiveStream + 多流多路复用无 HOL + createUnidirectionalStream）、单向发送/接收流（createSendStream + incomingUnidirectionalStreams + getStats 连接级统计 + 与 WebRTC DataChannel 对比）、拥塞控制与统计（throughput/low-latency + getStats 返回 bytesSent/Received/smoothedRtt + RTT 监控 + 自适应码率 AIMD）、实战场景（云游戏 WebCodecs 编码→datagram 下行 + 实时协作 Figma + 视频会议 + IoT 遥测 + WebCodecs 协同）、陷阱与决策矩阵（服务端需 HTTP/3 全栈 Nginx/Node 不支持 + 自签证书 sha-256 限制 + 移动端 UDP QoS + 降级链 WebTransport→WebSocketStream→WebSocket→SSE + TransportAdapter 抽象）。jsdom 无 WebTransport 所有检测为 false，仅记日志绝不抛异常；真实 Chrome 97+ 可完整体验。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,

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
