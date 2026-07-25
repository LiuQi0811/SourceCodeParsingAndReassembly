// =====================================================================
// AdvancedWebPlatformPage.js —— Web 平台高级特性补遗 实验室
// 演示前序页面未详细覆盖的 4 个高价值 Web 平台特性：
//   1. Worker Import Maps —— 模块 Worker 内使用 importmap + scopes 子路径映射
//      new Worker(url, { type: 'module' }) + 主线程 importmap 对 Worker 生效
//      + scopes 字段按 URL 前缀分流不同版本 + 微前端多版本共存
//   2. WebTransport 高级选项 —— serverCertHashes 自签名证书指纹
//      + congestionControl: "low-latency"|"throughput" 流量整形
//      + sendOrder 优先级 + reliable datagrams vs unreliable
//   3. Houdini Worklet 深潜 —— Animation Worklet (registerAnimator) +
//      Layout Worklet (registerLayout) 真实模块加载与 Worklet 全局作用域
//      + CSS.animationWorklet.addModule / CSS.layoutWorklet.addModule
//      + WorkletGlobalScope 限制（无 DOM/window，可用 registerCache）
//   4. WebCodecs 编码器配置 —— VideoEncoder init config 深潜
//      codec: 'avc1.42E01E' / 'vp09.00.10.08' / 'av01.0.04M.08'
//      hardwareAcceleration: 'no-preference'|'prefer-hardware'|'prefer-software'
//      latencyMode: 'realtime'|'normal'  + framerate/keyFrameInterval/Bitrate
//      + 硬件加速选择策略与回退
// 说明：所有特性调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常。jsdom 中多数 API 不可用，演示以代码片段 + manifest 示例形式展示。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class AdvancedWebPlatformPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      workerImportmapInfo: '', // Card 1：Worker Import Maps
      webtransportInfo: '',    // Card 2：WebTransport 高级
      workletInfo: '',         // Card 3：Houdini Worklet 深潜
      videoEncoderInfo: '',    // Card 4：WebCodecs 编码器配置
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._moduleWorker = null;     // Card 1 模块 Worker 引用（mock）
    this._webtransport = null;     // Card 2 WebTransport 连接（mock）
    this._videoEncoder = null;     // Card 4 VideoEncoder 实例

    const caps = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `Worker ${c(caps.worker)}`, `moduleWorker ${c(caps.moduleWorker)}`,
      `importmap ${c(caps.importmap)}`,
      `WebTransport ${c(caps.webtransport)}`,
      `animationWorklet ${c(caps.animationWorklet)}`,
      `layoutWorklet ${c(caps.layoutWorklet)}`,
      `VideoEncoder ${c(caps.videoEncoder)}`,
      `VideoFrame ${c(caps.videoFrame)}`,
    ];

    const any = caps.worker || caps.webtransport || caps.videoEncoder;
    const summary = any
      ? `Web 平台高级特性能力检测：${parts.join(' · ')}。当前环境部分 API 可用，点击按钮可触发真实调用；Worklet/WebTransport 编码器等需真实浏览器才能完整演示。`
      : `Web 平台高级特性能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）多数 API 不可用，所有按钮点击将仅记日志说明 + 展示代码示例，不会抛异常。在真实浏览器中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.moduleWorker) this._addLog('warn', '模块 Worker 不可用（jsdom 通常无 Worker，需真实浏览器 + type:"module"）');
    if (!caps.webtransport) this._addLog('warn', 'WebTransport 不可用（Chrome 97+ + HTTPS，jsdom 未实现）');
    if (!caps.animationWorklet) this._addLog('warn', 'CSS.animationWorklet 不可用（Chrome 85+ 实验性，jsdom 未实现）');
    if (!caps.layoutWorklet) this._addLog('warn', 'CSS.layoutWorklet 不可用（仅 Chrome 实验性 flag，jsdom 未实现）');
    if (!caps.videoEncoder) this._addLog('warn', 'VideoEncoder 不可用（Chrome 94+ + HTTPS，jsdom 未实现）');
  }

  componentWillUnmount() {
    // 释放 Worker
    if (this._moduleWorker && typeof this._moduleWorker.terminate === 'function') {
      try { this._moduleWorker.terminate(); } catch { /* noop */ }
    }
    this._moduleWorker = null;
    // 关闭 WebTransport
    if (this._webtransport) {
      try { if (typeof this._webtransport.close === 'function') this._webtransport.close(); } catch { /* noop */ }
    }
    this._webtransport = null;
    // 关闭 VideoEncoder
    if (this._videoEncoder && typeof this._videoEncoder.close === 'function') {
      try { this._videoEncoder.close(); } catch { /* noop */ }
    }
    this._videoEncoder = null;
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

  // 返回 Tag 数组：items = [[label, ok], ...]
  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // 返回布尔能力对象
  _flags() {
    const hasWorker = typeof Worker !== 'undefined';
    // 模块 Worker 检测：构造一个不真实加载的 Worker 来检测 type:'module' 支持
    // 实际中用 typeof + try/catch 检测，这里简化为 Worker 可用即认为模块 Worker 可用
    let hasWebTransport = false;
    try { hasWebTransport = typeof WebTransport !== 'undefined'; } catch { hasWebTransport = false; }
    let hasVideoEncoder = false;
    try { hasVideoEncoder = typeof VideoEncoder !== 'undefined'; } catch { hasVideoEncoder = false; }
    let hasVideoFrame = false;
    try { hasVideoFrame = typeof VideoFrame !== 'undefined'; } catch { hasVideoFrame = false; }
    // Houdini Worklet 检测
    let hasAnimationWorklet = false;
    try {
      hasAnimationWorklet = typeof CSS !== 'undefined' && !!CSS.animationWorklet &&
        typeof CSS.animationWorklet.addModule === 'function';
    } catch { hasAnimationWorklet = false; }
    let hasLayoutWorklet = false;
    try {
      hasLayoutWorklet = typeof CSS !== 'undefined' && !!CSS.layoutWorklet &&
        typeof CSS.layoutWorklet.addModule === 'function';
    } catch { hasLayoutWorklet = false; }
    // importmap 检测：通过 HTMLScriptElement.prototype 或 feature detection
    let hasImportmap = false;
    try {
      hasImportmap = typeof HTMLScriptElement !== 'undefined' &&
        'supports' in HTMLScriptElement &&
        HTMLScriptElement.supports('module');
      // 更准确的 importmap 检测
      if (!hasImportmap) {
        hasImportmap = typeof document !== 'undefined' &&
          document.createElement('script') &&
          'type' in document.createElement('script');
      }
    } catch { hasImportmap = false; }

    return {
      worker: hasWorker,
      moduleWorker: hasWorker, // 简化：Worker 可用即认为模块 Worker 可用（Chrome 80+/FF 114+）
      importmap: hasImportmap,
      webtransport: hasWebTransport,
      animationWorklet: hasAnimationWorklet,
      layoutWorklet: hasLayoutWorklet,
      videoEncoder: hasVideoEncoder,
      videoFrame: hasVideoFrame,
    };
  }

  // 兼容调用：无参返回布尔能力对象，有参返回 Tag 数组
  _caps(items) {
    if (items === undefined) return this._flags();
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // =================== Card 1：Worker Import Maps ===================

  _demoWorkerImportmap() {
    const f = this._flags();
    try {
      this.setState({ workerImportmapInfo:
        '===== Worker Import Maps（模块 Worker + importmap + scopes）=====\n\n' +
        '===== 基础：模块 Worker =====\n' +
        '  // 主线程：创建模块 Worker（type: "module"）\n' +
        '  const worker = new Worker("./worker.js", {\n' +
        '    type: "module",           // ★ 启用 ES Module 模式\n' +
        '    name: "my-worker",        // Worker 名字（用于调试）\n' +
        '    credentials: "same-origin", // 凭证策略\n' +
        '  });\n\n' +
        '  // worker.js 内可用 import/export\n' +
        '  import { helper } from "./utils.js";   // 相对路径\n' +
        '  import React from "react";             // ★ bare specifier 需 importmap\n' +
        '  helper();\n\n' +
        '===== Worker 内使用 importmap =====\n' +
        '  关键：主线程的 <script type="importmap"> 对同源的模块 Worker 生效！\n' +
        '  <!-- 主线程 HTML -->\n' +
        '  <script type="importmap">\n' +
        '  {\n' +
        '    "imports": {\n' +
        '      "react": "https://esm.sh/react@18.2.0",\n' +
        '      "react-dom": "https://esm.sh/react-dom@18.2.0",\n' +
        '      "lodash/": "https://esm.sh/lodash@4.17.21/"\n' +
        '    }\n' +
        '  }\n' +
        '  </script>\n' +
        '  <script>\n' +
        '    // Worker 内 import "react" 会按主线程 importmap 解析\n' +
        '    const worker = new Worker("./worker.js", { type: "module" });\n' +
        '  </script>\n\n' +
        '===== scopes 字段：按 URL 前缀分流不同版本 =====\n' +
        '  <script type="importmap">\n' +
        '  {\n' +
        '    "imports": {\n' +
        '      "react": "https://esm.sh/react@18.2.0"\n' +
        '    },\n' +
        '    "scopes": {\n' +
        '      "/legacy/": {                        // ★ 匹配 /legacy/ 前缀的 URL\n' +
        '        "react": "https://esm.sh/react@17.0.2"  // 用 React 17\n' +
        '      },\n' +
        '      "https://my-mfe.example.com/app2/": {  // 匹配外部 URL 前缀\n' +
        '        "react": "https://esm.sh/react@19.0.0"  // 用 React 19\n' +
        '      }\n' +
        '    }\n' +
        '  }\n' +
        '  </script>\n' +
        '  <!-- /legacy/worker.js 内 import "react" → React 17 -->\n' +
        '  <!-- /app/worker.js 内 import "react" → React 18（默认）-->\n' +
        '  <!-- https://my-mfe.example.com/app2/worker.js 内 import "react" → React 19 -->\n\n' +
        '===== 微前端多版本共存场景 =====\n' +
        '  场景：主应用用 React 18，微前端 A 用 React 17，微前端 B 用 React 19\n' +
        '  <script type="importmap">\n' +
        '  {\n' +
        '    "imports": {\n' +
        '      "react": "https://esm.sh/react@18.2.0",\n' +
        '      "react-dom": "https://esm.sh/react-dom@18.2.0"\n' +
        '    },\n' +
        '    "scopes": {\n' +
        '      "https://mfe-a.example.com/": {\n' +
        '        "react": "https://esm.sh/react@17.0.2",\n' +
        '        "react-dom": "https://esm.sh/react-dom@17.0.2"\n' +
        '      },\n' +
        '      "https://mfe-b.example.com/": {\n' +
        '        "react": "https://esm.sh/react@19.0.0",\n' +
        '        "react-dom": "https://esm.sh/react-dom@19.0.0"\n' +
        '      }\n' +
        '    }\n' +
        '  }\n' +
        '  </script>\n\n' +
        '===== 动态 importmap（二次注入）=====\n' +
        '  // importmap 必须在第一次 import 之前注入，且只能注入一次\n' +
        '  // 动态追加 importmap 用 <script type="importmap"> + appendChild\n' +
        '  const newMap = document.createElement("script");\n' +
        '  newMap.type = "importmap";\n' +
        '  newMap.textContent = JSON.stringify({\n' +
        '    imports: { "vue": "https://esm.sh/vue@3.4.0" }\n' +
        '  });\n' +
        '  document.head.appendChild(newMap);  // ★ 必须在任何 import 之前\n' +
        '  // 注意：第二个 importmap 不能覆盖第一个已存在的 key\n\n' +
        `Worker 可用：${f.worker ? '✓' : '✗'}\n` +
        `模块 Worker (type:"module") 可用：${f.moduleWorker ? '✓' : '✗'}（Chrome 80+/Firefox 114+/Safari 15+）\n` +
        `importmap 可用：${f.importmap ? '✓' : '✗'}（Chrome 89+/Firefox 108+/Safari 16.4+）\n\n` +
        '===== 浏览器支持 =====\n' +
        '  模块 Worker：Chrome 80+ / Firefox 114+ / Safari 15+\n' +
        '  importmap：Chrome 89+ / Firefox 108+ / Safari 16.4+\n' +
        '  Worker 内 importmap：与主线程 importmap 同步生效（Chrome 89+）\n' +
        '  scopes 字段：Chrome 89+ / Firefox 108+ / Safari 16.4+' });
      this._addLog('wim', `Worker Import Maps 演示完成；worker=${f.worker}, importmap=${f.importmap}`);
    } catch (err) {
      this._addLog('warn', `Worker Importmap 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. Worker Import Maps（模块 Worker + importmap + scopes）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['moduleWorker', f.moduleWorker], ['importmap', f.importmap]]),
        h(Tag, { color: 'primary' }, 'Chrome 89+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '模块 Worker (new Worker(url, { type: "module" })) 启用 ES Module 模式后可用 import/export。关键：主线程 <script type="importmap"> 对同源模块 Worker 同步生效，Worker 内 import "react" 会按主线程 importmap 解析。scopes 字段按 URL 前缀分流不同版本（微前端多版本共存）。动态追加 importmap 必须在任何 import 之前注入。Chrome 89+/Firefox 108+/Safari 16.4+。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 Worker Importmap 用法', { type: 'primary', size: 'sm', onClick: () => this._demoWorkerImportmap() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.workerImportmapInfo || '（点击按钮查看 Worker Import Maps 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：WebTransport 高级选项 ===================

  async _demoWebTransportAdvanced() {
    const f = this._flags();
    if (!f.webtransport) {
      this.setState({ webtransportInfo:
        'WebTransport 不可用（需 Chrome 97+ + HTTPS + HTTP/3 服务器）\n\n' +
        '===== WebTransport 高级选项 =====\n\n' +
        '===== 1. serverCertHashes：自签名证书指纹 =====\n' +
        '  动机：WebTransport over HTTP/3 不依赖 CA 信任链，\n' +
        '    可直接用自签名证书（通过指纹验证，类似 SSH known_hosts）\n\n' +
        '  const transport = new WebTransport("https://wt.example.com:443", {\n' +
        '    serverCertHashes: [{\n' +
        '      algorithm: "sha-256",           // 仅支持 sha-256\n' +
        '      value: base64Decode("..."),      // 证书公钥的 SHA-256 哈希\n' +
        '    }],\n' +
        '  });\n\n' +
        '  // 获取证书指纹的方法：\n' +
        '  // 1. 服务端启动时输出证书 SHA-256\n' +
        '  // 2. openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64\n\n' +
        '===== 2. congestionControl：流量整形 =====\n' +
        '  动机：不同应用场景对延迟/吞吐的需求不同\n' +
        '    - 实时音视频/游戏：低延迟优先（可接受少量丢包）\n' +
        '    - 大文件传输/备份：吞吐优先（可接受较高延迟）\n\n' +
        '  const transport = new WebTransport("https://wt.example.com:443", {\n' +
        '    congestionControl: "low-latency",  // 或 "throughput"（默认 "default"）\n' +
        '    // low-latency：激进拥塞控制，减少缓冲，适合实时\n' +
        '    // throughput：保守拥塞控制，最大化带宽利用率\n' +
        '    // default：平衡模式\n' +
        '  });\n\n' +
        '===== 3. sendOrder：发送优先级 =====\n' +
        '  // 单向流和 datagram 支持 sendOrder 优先级排序\n' +
        '  const writer = transport.datagrams.writable.getWriter();\n' +
        '  writer.write(data, { sendOrder: 100 });  // 高优先级（数值越大越优先）\n\n' +
        '  // 双向流也可设置优先级\n' +
        '  const bidi = await transport.createBidirectionalStream({\n' +
        '    sendOrder: 50,  // 该流的所有写入按此优先级排序\n' +
        '  });\n\n' +
        '===== 4. reliable datagrams vs unreliable =====\n' +
        '  WebTransport datagrams 默认 unreliable（不保证送达/顺序）\n' +
        '  Chrome 118+ 支持 "reliable datagrams"（通过 undirectional stream 模拟）\n\n' +
        '  // unreliable datagram（默认）\n' +
        '  transport.datagrams.writable.getWriter().write(data);\n\n' +
        '  // reliable "datagram"（用 unidirectional stream 模拟）\n' +
        '  const uni = await transport.createUnidirectionalStream();\n' +
        '  const writer = uni.getWriter();\n' +
        '  writer.write(data);\n' +
        '  writer.close();\n\n' +
        '===== 5. 完整高级配置示例 =====\n' +
        '  const transport = new WebTransport(\n' +
        '    "https://wt.example.com:443",\n' +
        '    {\n' +
        '      serverCertHashes: [{\n' +
        '        algorithm: "sha-256",\n' +
        '        value: base64Decode("abc123..."),\n' +
        '      }],\n' +
        '      congestionControl: "low-latency",\n' +
        '      // allowPooling: true,    // 允许连接池复用（默认 true）\n' +
        '      // serverCertificateHashes: [...],  // 旧名，已改 serverCertHashes\n' +
        '    }\n' +
        '  );\n' +
        '  await transport.ready;  // 等待连接建立\n' +
        '  console.log("connected, congestion:", transport.congestionControl);\n\n' +
        '===== 浏览器支持 =====\n' +
        '  WebTransport 基础：Chrome 97+ / Firefox 114+ / Safari 17+\n' +
        '  serverCertHashes：Chrome 97+ / Firefox 114+ / Safari 17+\n' +
        '  congestionControl：Chrome 110+（之前为 undefined）\n' +
        '  sendOrder：Chrome 115+\n' +
        '  reliable datagrams：Chrome 118+（实验性）' });
      this._addLog('warn', 'WebTransport 不可用，已展示高级选项代码示例');
      return;
    }
    try {
      // 真实环境：构造 WebTransport（不真实连接，仅展示配置）
      const url = 'https://wt.example.com:443';
      const options = {
        serverCertHashes: [{
          algorithm: 'sha-256',
          value: new Uint8Array([0xab, 0xcd, 0xef]), // mock 指纹
        }],
        congestionControl: 'low-latency',
      };
      // 仅检测构造器是否接受这些选项，不真实连接
      this._webtransport = new WebTransport(url, options);
      this.setState({ webtransportInfo:
        `===== WebTransport 高级选项演示 =====\n\n` +
        `URL: ${url}\n` +
        `options: ${JSON.stringify(options, (k, v) =>
          k === 'value' ? `Uint8Array(${v.length})` : v, 2)}\n\n` +
        `WebTransport 构造成功 ✓\n` +
        `transport.congestionControl = ${this._webtransport.congestionControl || '(undefined, Chrome <110)'}\n\n` +
        '===== 高级选项说明 =====\n' +
        '  serverCertHashes：自签名证书指纹（SHA-256），不依赖 CA 信任链\n' +
        '  congestionControl: "low-latency"|"throughput"|"default" 流量整形\n' +
        '  sendOrder：datagram/流写入优先级（数值越大越优先）\n' +
        '  reliable datagrams：用 unidirectional stream 模拟可靠 datagram\n\n' +
        '（未真实连接，仅展示构造器配置；真实连接需 HTTP/3 服务器）' });
      this._addLog('wt', `WebTransport 构造成功；congestion=${this._webtransport.congestionControl}`);
    } catch (err) {
      this._addLog('warn', `WebTransport 演示失败：${err.name} - ${err.message}`);
      this.setState({ webtransportInfo: `WebTransport 演示失败：${err.name} - ${err.message}\n\n（参考代码示例了解真实用法）` });
    }
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. WebTransport 高级选项（serverCertHashes / congestionControl）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['WebTransport', f.webtransport]]),
        h(Tag, { color: 'primary' }, 'Chrome 97+/110+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'WebTransport 高级选项：serverCertHashes 自签名证书指纹（SHA-256，不依赖 CA 信任链，类似 SSH known_hosts）；congestionControl: "low-latency"|"throughput"|"default" 流量整形（实时音视频用 low-latency，大文件用 throughput，Chrome 110+）；sendOrder datagram/流写入优先级排序（Chrome 115+）；reliable datagrams 用 unidirectional stream 模拟可靠送达（Chrome 118+ 实验性）。基础 datagrams 默认 unreliable（不保证送达/顺序）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 WebTransport 高级选项', { type: 'primary', size: 'sm', disabled: !f.webtransport, onClick: () => this._demoWebTransportAdvanced() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.webtransportInfo || '（点击按钮查看 WebTransport 高级选项）')),
        h(Alert, {
          type: 'info',
          message: 'WebTransport 需 HTTP/3 服务器 + HTTPS',
          description: 'serverCertHashes 允许自签名证书（不依赖 CA），适合内部服务/开发环境。congestionControl 在 Chrome 110+ 可通过 transport.congestionControl 属性读取实际生效值。sendOrder 用于多流优先级调度（如音视频流优先于控制信令）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Houdini Worklet 深潜 ===================

  _demoWorkletDeep() {
    const f = this._flags();
    try {
      this.setState({ workletInfo:
        '===== Houdini Worklet 深潜（Animation Worklet + Layout Worklet）=====\n\n' +
        '===== 1. Animation Worklet（registerAnimator）=====\n' +
        '  动机：把滚动驱动/离屏动画移出主线程，避免 jank\n\n' +
        '  // 1) 加载 Worklet 模块\n' +
        '  await CSS.animationWorklet.addModule("./animator.js");\n\n' +
        '  // 2) animator.js（Worklet 全局作用域）\n' +
        '  registerAnimator("parallax", class {\n' +
        '    constructor(options = {}) {\n' +
        '      this.factor = options.factor || 0.5;  // 视差因子\n' +
        '    }\n' +
        '    // ★ animate() 每帧调用，驱动元素属性\n' +
        '    animate(currentTime, effect) {\n' +
        '      const scroll = currentTime;  // currentTime 可绑定 scroll timeline\n' +
        '      effect.localTime = scroll * this.factor;  // 设置元素时间线\n' +
        '    }\n' +
        '  });\n\n' +
        '  // 3) 主线程使用（WorkletAnimation）\n' +
        '  const scrollTimeline = new ScrollTimeline({\n' +
        '    source: document.scrollingElement,\n' +
        '    orientation: "block",\n' +
        '  });\n' +
        '  const animation = new WorkletAnimation(\n' +
        '    "parallax",                  // animator 名字（对应 registerAnimator）\n' +
        '    new KeyframeEffect(\n' +
        '      document.querySelector(".parallax"),\n' +
        '      [{ transform: "translateY(0)" }, { transform: "translateY(-100px)" }],\n' +
        '      { duration: 1000 }\n' +
        '    ),\n' +
        '    scrollTimeline,              // 时间线（ScrollTimeline / DocumentTimeline）\n' +
        '    { factor: 0.3 }              // options 传给 animator constructor\n' +
        '  );\n' +
        '  animation.play();\n\n' +
        '===== 2. Layout Worklet（registerLayout）=====\n' +
        '  动机：用 JS 实现自定义 display: layout(...) 布局（masonry/瀑布流等）\n\n' +
        '  // 1) 加载 Worklet 模块\n' +
        '  await CSS.layoutWorklet.addModule("./layout.js");\n\n' +
        '  // 2) layout.js（Worklet 全局作用域）\n' +
        '  registerLayout("masonry", class {\n' +
        '    // ★ 静态属性：声明布局输入\n' +
        '    static inputProperties = ["--column-count", "--gap"];\n' +
        '    static childInputProperties = ["--item-span"];  // 子元素属性\n' +
        '    static layoutOptions = {\n' +
        '      childDisplay: "normal",      // 或 "block"\n' +
        '      sizing: "block-like",        // 或 "manual"\n' +
        '    };\n\n' +
        '    // ★ layout() 执行布局计算\n' +
        '    async layout(children, edges, constraints, style, breakToken) {\n' +
        '      const columns = parseInt(style.get("--column-count")) || 3;\n' +
        '      const gap = parseFloat(style.get("--gap")) || 8;\n' +
        '      const columnWidth = (constraints.fixedInlineSize - gap * (columns - 1)) / columns;\n\n' +
        '      // 初始化各列高度\n' +
        '      const columnHeights = new Array(columns).fill(0);\n' +
        '      const childFragments = [];\n\n' +
        '      for (const child of children) {\n' +
        '        // 找最短列\n' +
        '        const minCol = columnHeights.indexOf(Math.min(...columnHeights));\n' +
        '        const x = minCol * (columnWidth + gap);\n' +
        '        const y = columnHeights[minCol];\n\n' +
        '        // 计算子元素尺寸\n' +
        '        const childFragment = await child.layoutNextFragment({\n' +
        '          fixedInlineSize: columnWidth,\n' +
        '          fixedBlockSize: constraints.availableBlockSize,\n' +
        '        });\n\n' +
        '        // 设置位置\n' +
        '        childFragment.inlineOffset = x;\n' +
        '        childFragment.blockOffset = y;\n' +
        '        columnHeights[minCol] += childFragment.blockSize + gap;\n' +
        '        childFragments.push(childFragment);\n' +
        '      }\n\n' +
        '      return {\n' +
        '        childFragments,\n' +
        '        autoBlockSize: Math.max(...columnHeights),  // 容器高度\n' +
        '      };\n' +
        '    }\n' +
        '  });\n\n' +
        '  // 3) CSS 使用自定义布局\n' +
        '  .masonry-container {\n' +
        '    display: layout(masonry);     /* ★ 调用 registerLayout 的名字 */\n' +
        '    --column-count: 3;\n' +
        '    --gap: 12px;\n' +
        '  }\n\n' +
        '===== 3. WorkletGlobalScope 限制 =====\n' +
        '  Worklet 运行在独立的 WorkletGlobalScope 中，与主线程隔离：\n' +
        '  ✓ 可用：registerAnimator/registerLayout/registerPaint\n' +
        '         CSSStyleValue/styleMap（只读）/Math/TypedArray/Request\n' +
        '  ✗ 不可用：document/window/localStorage/DOM API\n' +
        '         setTimeout/setInterval（用 requestAnimationFrame 替代）\n' +
        '         console（部分实现可用，但不保证）\n\n' +
        '  特殊：Worklet 可用 registerCache() 创建缓存（避免重复计算）\n\n' +
        '===== 4. Paint Worklet 对比（已在前序页面覆盖）=====\n' +
        '  registerPaint + CSS.paintWorklet.addModule（CSSHoudiniPage 已详细演示）\n' +
        '  本卡片聚焦未覆盖的 Animation/Layout Worklet\n\n' +
        `CSS.animationWorklet 可用：${f.animationWorklet ? '✓' : '✗'}（Chrome 85+ 实验性）\n` +
        `CSS.layoutWorklet 可用：${f.layoutWorklet ? '✓' : '✗'}（仅 Chrome flag 实验性）\n\n` +
        '===== 浏览器支持 =====\n' +
        '  Paint Worklet：Chrome 65+ / Firefox 117+ / Safari 17.4+（已稳定）\n' +
        '  Animation Worklet：Chrome 85+ 实验性（需 flag）/ Firefox 未实现 / Safari 未实现\n' +
        '  Layout Worklet：仅 Chrome 实验性 flag，无稳定支持\n' +
        '  ScrollTimeline：Chrome 115+ 稳定 / Firefox 109+ / Safari 17.4+' });
      this._addLog('worklet', `Worklet 深潜演示完成；animation=${f.animationWorklet}, layout=${f.layoutWorklet}`);
    } catch (err) {
      this._addLog('warn', `Worklet 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. Houdini Worklet 深潜（Animation Worklet + Layout Worklet）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['animationWorklet', f.animationWorklet], ['layoutWorklet', f.layoutWorklet]]),
        h(Tag, { color: 'primary' }, '实验性'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Animation Worklet (CSS.animationWorklet.addModule + registerAnimator + WorkletAnimation) 把滚动驱动/离屏动画移出主线程避免 jank，animate(currentTime, effect) 每帧驱动元素属性。Layout Worklet (CSS.layoutWorklet.addModule + registerLayout + display: layout(name)) 用 JS 实现自定义布局（masonry/瀑布流），layout(children, edges, constraints, style) 执行布局计算。两者运行在 WorkletGlobalScope（无 DOM/window，可用 registerCache 缓存）。Paint Worklet 已在 CSSHoudiniPage 覆盖，本卡片聚焦未覆盖的 Animation/Layout Worklet。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 Worklet 深潜用法', { type: 'primary', size: 'sm', onClick: () => this._demoWorkletDeep() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '540px', overflow: 'auto' } },
          h('code', {}, s.workletInfo || '（点击按钮查看 Animation/Layout Worklet 完整用法）')),
        h(Alert, {
          type: 'warning',
          message: 'Animation/Layout Worklet 仍处实验阶段',
          description: 'Paint Worklet 已稳定（Chrome 65+/Firefox 117+/Safari 17.4+），但 Animation Worklet 需 Chrome flag，Layout Worklet 仅 Chrome 实验性 flag，无稳定支持。生产环境暂不可用，仅作为未来特性参考。ScrollTimeline 已稳定（Chrome 115+），可与 Animation Worklet 协同。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：WebCodecs 编码器配置 ===================

  async _demoVideoEncoderConfig() {
    const f = this._flags();
    if (!f.videoEncoder) {
      this.setState({ videoEncoderInfo:
        'VideoEncoder 不可用（需 Chrome 94+ + HTTPS）\n\n' +
        '===== WebCodecs VideoEncoder 配置深潜 =====\n\n' +
        '===== 1. codec 字符串语法 =====\n' +
        '  VideoEncoder init.config.codec 支持的格式：\n\n' +
        '  // H.264 / AVC（最广泛兼容）\n' +
        '  "avc1.42E01E"  // Baseline 3.0\n' +
        '  "avc1.4D401E"  // Main 3.0\n' +
        '  "avc1.640028"  // High 4.0\n' +
        '  // 语法：avc1.<Profile><Constraint><Level>\n' +
        '  //   Profile: 42=Baseline / 4D=Main / 64=High\n' +
        '  //   Constraint: E=Constraint Set 0\n' +
        '  //   Level: 1E=3.0 / 28=4.0 / 32=5.0 / 50=5.1\n\n' +
        '  // VP9\n' +
        '  "vp09.00.10.08"  // Profile 0, Level 1.0, Bit Depth 8\n' +
        '  // 语法：vp09.<Profile>.<Level>.<BitDepth>\n\n' +
        '  // AV1\n' +
        '  "av01.0.04M.08"  // Main Profile, Level 4.0, Main Tier, 8-bit\n' +
        '  // 语法：av01.<Profile>.<Level><Tier>.<BitDepth>\n\n' +
        '===== 2. hardwareAcceleration 硬件加速选择 =====\n' +
        '  const encoder = new VideoEncoder({\n' +
        '    output: (chunk, metadata) => { /* 处理编码后的 chunk */ },\n' +
        '    error: (e) => console.error(e.message),\n' +
        '  });\n\n' +
        '  await encoder.configure({\n' +
        '    codec: "avc1.42E01E",\n' +
        '    width: 1920,\n' +
        '    height: 1080,\n' +
        '    bitrate: 5_000_000,          // 5 Mbps\n' +
        '    framerate: 30,\n' +
        '    hardwareAcceleration: "prefer-hardware",  // ★ 硬件加速策略\n' +
        '    // "no-preference"（默认）：浏览器自选，通常优先硬件\n' +
        '    // "prefer-hardware"：强制硬件编码（GPU/专用编码器，低 CPU/低延迟）\n' +
        '    // "prefer-software"：强制软件编码（CPU，兼容性最好，可控性高）\n' +
        '  });\n\n' +
        '  // 检测是否真的用了硬件加速（Chrome 94+）\n' +
        '  console.log(encoder.encodeQueueSize);\n' +
        '  // hardwareAcceleration 实际生效值需通过 metadata 间接判断\n\n' +
        '===== 3. latencyMode 延迟模式 =====\n' +
        '  await encoder.configure({\n' +
        '    codec: "avc1.42E01E",\n' +
        '    width: 1280,\n' +
        '    height: 720,\n' +
        '    bitrate: 2_500_000,\n' +
        '    latencyMode: "realtime",  // ★ 延迟模式\n' +
        '    // "realtime"：实时编码（低延迟，适合直播/视频会议）\n' +
        '    //   - 立即输出 chunk，不等满帧\n' +
        '    //   - 可能牺牲质量换速度\n' +
        '    //   - 支持 drop 模丢帧\n' +
        '    // "normal"（默认）：正常编码（高质量，适合点播/录制）\n' +
        '    //   - 缓冲多帧优化压缩率\n' +
        '    //   - 延迟较高（数百 ms）\n' +
        '    framerate: 30,\n' +
        '    keyFrameInterval: 90,  // 每 3 秒一个 I 帧（30fps × 3s）\n' +
        '  });\n\n' +
        '===== 4. 关键帧与码率控制 =====\n' +
        '  // keyFrameInterval：I 帧间隔（帧数）\n' +
        '  //   直播通常 2-3 秒（framerate × 2 或 × 3）\n' +
        '  //   点播可更长（10+ 秒，省带宽）\n\n' +
        '  // 码率控制模式（通过 avc/bitrateMode，Chrome 部分支持）\n' +
        '  //   "constant"：恒定码率（CBR，直播首选）\n' +
        '  //   "variable"：可变码率（VBR，点播首选，质量更均匀）\n' +
        '  //   "quantizer"：量化参数模式（固定 QP，质量恒定）\n\n' +
        '  // avc 专用选项（H.264）\n' +
        '  avc: { format: "annexb" }  // 或 "avc"，NAL 单元格式\n\n' +
        '===== 5. 编码流程示例 =====\n' +
        '  const encoder = new VideoEncoder({\n' +
        '    output: (chunk, metadata) => {\n' +
        '      // chunk: EncodedVideoChunk\n' +
        '      // metadata: { decoderConfig, sx, sy, spatialLayers, alphaSide }\n' +
        '      if (metadata.decoderConfig) {\n' +
        '        // 第一个 chunk 携带 decoderConfig（SPS/PPS 等）\n' +
        '        console.log("decoder config:", metadata.decoderConfig);\n' +
        '      }\n' +
        '      // chunk.type: "key" | "delta"\n' +
        '      // chunk.byteLength / chunk.timestamp / chunk.duration\n' +
        '    },\n' +
        '    error: (e) => console.error("encoder error:", e.message),\n' +
        '  });\n\n' +
        '  await encoder.configure({\n' +
        '    codec: "avc1.640028",\n' +
        '    width: 1920, height: 1080,\n' +
        '    bitrate: 5_000_000,\n' +
        '    framerate: 30,\n' +
        '    hardwareAcceleration: "prefer-hardware",\n' +
        '    latencyMode: "realtime",\n' +
        '    keyFrameInterval: 60,  // 每 2 秒一个 I 帧\n' +
        '  });\n\n' +
        '  // 编码 VideoFrame（从 canvas/video/ImageDecoder 创建）\n' +
        '  const frame = new VideoFrame(canvas, {\n' +
        '    timestamp: performance.now() * 1000,  // 微秒\n' +
        '    duration: 33_333,  // 30fps ≈ 33.3ms\n' +
        '  });\n' +
        '  encoder.encode(frame, { keyFrame: false });  // delta 帧\n' +
        '  // 或 encoder.encode(frame, { keyFrame: true });  // 强制 I 帧\n' +
        '  frame.close();  // ★ 用完即 close，避免内存泄漏\n\n' +
        '  await encoder.flush();  // 刷新编码器\n' +
        '  encoder.close();  // 释放\n\n' +
        '===== 6. 硬件加速选择策略 =====\n' +
        '  场景 → 推荐策略：\n' +
        '  · 直播/视频会议（低延迟）→ prefer-hardware + realtime + CBR\n' +
        '  · 点播录制（高质量）→ prefer-hardware + normal + VBR\n' +
        '  · 兼容性优先（老设备）→ prefer-software（CPU 编码，可控性高）\n' +
        '  · 服务器端编码 → prefer-software（无 GPU 或 GPU 不可用）\n\n' +
        '  回退：若 prefer-hardware 失败（isConfigSupported 返回 false），\n' +
        '    降级到 no-preference 或 prefer-software\n' +
        '  const support = await VideoEncoder.isConfigSupported(config);\n' +
        '  if (!support.supported) { /* 降级到更兼容的 codec/config */ }\n\n' +
        `VideoEncoder 可用：${f.videoEncoder ? '✓' : '✗'}（Chrome 94+/Firefox 130+/Safari 17+）\n` +
        `VideoFrame 可用：${f.videoFrame ? '✓' : '✗'}\n\n` +
        '===== 浏览器支持 =====\n' +
        '  VideoEncoder/VideoDecoder：Chrome 94+ / Firefox 130+ / Safari 17+\n' +
        '  hardwareAcceleration：Chrome 94+ / Firefox 部分 / Safari 部分\n' +
        '  latencyMode: "realtime"：Chrome 94+ / Firefox 130+ / Safari 17+\n' +
        '  AV1 编码：Chrome 111+（硬件）/ Firefox 130+（软件）' });
      this._addLog('warn', 'VideoEncoder 不可用，已展示编码器配置代码示例');
      return;
    }
    // 真实环境：检测支持的配置
    try {
      const configs = [
        { codec: 'avc1.42E01E', width: 640, height: 480, bitrate: 1_000_000, framerate: 30,
          hardwareAcceleration: 'prefer-hardware', latencyMode: 'realtime' },
        { codec: 'avc1.640028', width: 1920, height: 1080, bitrate: 5_000_000, framerate: 30,
          hardwareAcceleration: 'prefer-software', latencyMode: 'normal' },
        { codec: 'vp09.00.10.08', width: 1280, height: 720, bitrate: 2_500_000, framerate: 30 },
        { codec: 'av01.0.04M.08', width: 1280, height: 720, bitrate: 2_500_000, framerate: 30 },
      ];
      const results = [];
      for (const cfg of configs) {
        try {
          const support = await VideoEncoder.isConfigSupported(cfg);
          results.push(`${support.supported ? '✓' : '✗'} ${cfg.codec} ${cfg.width}x${cfg.height} hw=${cfg.hardwareAcceleration || 'default'} latency=${cfg.latencyMode || 'default'} → supported=${support.supported}${support.config ? ', config=' + JSON.stringify(support.config).slice(0, 80) : ''}`);
        } catch (e) {
          results.push(`✗ ${cfg.codec} → 检测失败: ${e.message}`);
        }
      }
      this.setState({ videoEncoderInfo:
        `===== VideoEncoder 配置检测 =====\n\n` +
        `VideoEncoder.isConfigSupported() 结果：\n${results.join('\n')}\n\n` +
        '===== 配置字段说明 =====\n' +
        '  codec: 编码格式字符串（avc1./vp09./av01.）\n' +
        '  hardwareAcceleration: "no-preference"|"prefer-hardware"|"prefer-software"\n' +
        '  latencyMode: "realtime"（低延迟直播）|"normal"（高质量点播）\n' +
        '  bitrate: 目标码率（bps）\n' +
        '  framerate: 目标帧率\n' +
        '  keyFrameInterval: I 帧间隔（帧数，直播 2-3s，点播 10+s）\n' +
        '  avc: { format: "annexb"|"avc" }（H.264 NAL 格式）\n\n' +
        '===== 硬件加速选择策略 =====\n' +
        '  · 直播/会议（低延迟）→ prefer-hardware + realtime + CBR\n' +
        '  · 点播录制（高质量）→ prefer-hardware + normal + VBR\n' +
        '  · 兼容性优先 → prefer-software\n' +
        '  · 降级：prefer-hardware 失败 → no-preference → prefer-software' });
      this._addLog('enc', `检测 ${configs.length} 个 VideoEncoder 配置`);
    } catch (err) {
      this._addLog('warn', `VideoEncoder 检测失败：${err.name} - ${err.message}`);
      this.setState({ videoEncoderInfo: `VideoEncoder 检测失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. WebCodecs VideoEncoder 配置深潜',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['VideoEncoder', f.videoEncoder], ['VideoFrame', f.videoFrame]]),
        h(Tag, { color: 'primary' }, 'Chrome 94+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'VideoEncoder init config 深潜：codec 字符串语法（avc1.<Profile><Constraint><Level> / vp09.<Profile>.<Level>.<BitDepth> / av01.<Profile>.<Level><Tier>.<BitDepth>）；hardwareAcceleration: "no-preference"|"prefer-hardware"|"prefer-software" 硬件加速策略（直播用硬件低延迟，兼容用软件）；latencyMode: "realtime"（低延迟直播，立即输出 chunk）|"normal"（高质量点播，缓冲优化）；keyFrameInterval I 帧间隔（直播 2-3s，点播 10+s）；avc.format NAL 格式。isConfigSupported() 预检测配置支持并降级。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 VideoEncoder 配置', { type: 'primary', size: 'sm', disabled: !f.videoEncoder, onClick: () => this._demoVideoEncoderConfig() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '540px', overflow: 'auto' } },
          h('code', {}, s.videoEncoderInfo || '（点击按钮查看 VideoEncoder 配置深潜）')),
        h(Alert, {
          type: 'info',
          message: '硬件加速选择是直播/点播场景的关键决策',
          description: 'prefer-hardware 用 GPU/专用编码器（低 CPU/低延迟，但可控性低）；prefer-software 用 CPU（兼容性好，可控性高，适合服务器端）。realtime 模式立即输出 chunk 不等满帧（直播必需），normal 模式缓冲多帧优化压缩率（点播首选）。VideoFrame 用完必须 close() 避免内存泄漏。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // —— 日志面板 ——
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
      h('h2', { class: 'section-title' }, 'Web 平台高级特性补遗实验室'),

      h(Alert, {
        type: 'info',
        message: '前序页面未详细覆盖的 4 个高价值 Web 平台特性',
        description: '演示 Worker Import Maps（模块 Worker + importmap + scopes 子路径映射 + 微前端多版本共存）、WebTransport 高级选项（serverCertHashes 自签名证书指纹 + congestionControl 流量整形 + sendOrder 优先级 + reliable datagrams）、Houdini Worklet 深潜（Animation Worklet registerAnimator + WorkletAnimation + Layout Worklet registerLayout + 自定义 masonry 布局 + WorkletGlobalScope 限制）、WebCodecs VideoEncoder 配置深潜（codec 字符串语法 + hardwareAcceleration 硬件加速选择 + latencyMode 延迟模式 + keyFrameInterval + 硬件加速选择策略与降级）。所有 API 调用前做 typeof 能力检测，不可用时仅记日志 + 展示代码示例。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),

      this._renderLogPanel(),
    ];
  }
}
