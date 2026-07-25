// =====================================================================
// RTCEncodedTransformPage.js —— RTCEncodedTransform / WebRTC Insertable
// Streams 深度实验室（端到端加密视频会议、AI 背景替换）
// 演示 W3C WebRTC Insertable Streams（统称「可插入流」）演进路线：
//   1. 概念与演进：Insertable Streams → RTCEncodedTransform /
//      RTCRtpScriptTransform + 工作线程模型 + 与 WebCodecs 区别 +
//      浏览器支持矩阵
//   2. transform 绑定：RTCRtpSender.transform / RTCRtpReceiver.transform
//      绑定 + new RTCRtpScriptTransform(worker, name, options) 构造器 +
//      options 透传
//   3. Worker 端事件：self.onrtcrtpscripttransform 事件 + event.transformer
//      + transformer.readable/writable 端到端管道 + pipeThrough
//   4. EncodedFrame 接口：RTCEncodedVideoFrame / RTCEncodedAudioFrame
//      接口（type/timestamp/metadata/data ArrayBuffer +
//      getMetadata()/getContributingSources()）
//   5. SFrame 端到端加密实战：密钥协商 + AES-GCM 加密 transform +
//      解密 transform + nonce 管理 + 与 Web Crypto 协同
//   6. 与 WebCodecs 互转：RTCEncodedVideoFrame ↔ VideoFrame 互转 +
//      VideoEncoder/VideoDecoder 自定义转码管线 + 实时背景虚化
//   7. 实战场景：实时背景虚化（VideoFrame → Canvas → VideoFrame）、
//      水印注入、音频降噪（AudioData 走 WASM）
//   8. 能力检测与降级：RTCRtpSender.prototype.transform in 检测 +
//      降级到 RTCRtpSender.createEncodedStreams()（旧 API）+
//      与 MediaStreamTrackProcessor 协同 + 浏览器支持矩阵
// 说明：jsdom 不实现真实 WebRTC 栈，RTCRtpScriptTransform /
//       RTCEncodedVideoFrame 等全部 typeof 检测为 false，所有按钮点击
//       仅记日志说明（_addLog('warn', ...)）并展示完整代码示例与 API
//       签名参考，绝不会抛异常；真实浏览器（Chrome 86+ / Edge 86+）
//       可完整体验 Insertable Streams 能力。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class RTCEncodedTransformPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      conceptInfo: '',            // Card 1：概念与演进
      transformBindingInfo: '',   // Card 2：transform 绑定
      workerEventInfo: '',        // Card 3：Worker 端事件
      encodedFrameInfo: '',       // Card 4：EncodedFrame 接口
      sframeInfo: '',             // Card 5：SFrame 端到端加密实战
      webcodecsInfo: '',          // Card 6：与 WebCodecs 互转
      scenarioInfo: '',           // Card 7：实战场景
      detectionInfo: '',          // Card 8：能力检测与降级
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `RTCRtpScriptTransform ${c(f.rtcRtpScriptTransform)}`,
      `sender.transform ${c(f.senderTransform)}`,
      `createEncodedStreams ${c(f.createEncodedStreams)}`,
      `RTCEncodedVideoFrame ${c(f.encodedVideoFrame)}`,
      `RTCEncodedAudioFrame ${c(f.encodedAudioFrame)}`,
      `MediaStreamTrackProcessor ${c(f.trackProcessor)}`,
      `VideoFrame ${c(f.videoFrame)}`,
      `VideoEncoder/Decoder ${c(f.videoEncoder && f.videoDecoder)}`,
      `AudioData ${c(f.audioData)}`,
      `WebCrypto subtle ${c(f.webCrypto)}`,
    ];

    const any = f.rtcRtpScriptTransform || f.senderTransform || f.createEncodedStreams;
    const summary = any
      ? `WebRTC Insertable Streams 能力检测：${parts.join(' · ')}。当前环境部分支持，可体验真实 RTCEncodedTransform 管线；SFrame 加密 / WebCodecs 互转等高级能力依赖配套 API 齐备。`
      : `WebRTC Insertable Streams 能力检测：${parts.join(' · ')}。jsdom/Node 环境无真实 WebRTC 栈，RTCRtpScriptTransform / RTCEncodedVideoFrame 等全部 typeof 为 undefined，所有按钮点击仅记日志说明（_addLog('warn', ...)）并展示完整代码示例与 API 签名参考，不会抛异常；真实浏览器（Chrome 86+ / Edge 86+）可完整体验。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.rtcRtpScriptTransform) this._addLog('warn', 'RTCRtpScriptTransform 不可用（jsdom 无 WebRTC，真实浏览器需 Chrome 86+ / Edge 86+）');
    if (!f.senderTransform) this._addLog('warn', 'RTCRtpSender.prototype.transform 不可用（新 API 标志位）');
    if (!f.createEncodedStreams) this._addLog('warn', 'RTCRtpSender.createEncodedStreams 不可用（旧 Insertable Streams API，Chrome 86-105）');
    if (!f.encodedVideoFrame) this._addLog('warn', 'RTCEncodedVideoFrame 不可用（仅 worker 内可见）');
    if (!f.videoFrame) this._addLog('warn', 'VideoFrame 不可用（WebCodecs，Chrome 94+ / Safari 16.4+）');
    if (!f.webCrypto) this._addLog('warn', 'crypto.subtle 不可用（SFrame 加密依赖，需 HTTPS 或 localhost）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
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

  _injectBaseStyles() {
    this._injectStyle('rtc-et-base', `
      .rtc-et-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .rtc-et-pipeline {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 8px;
        margin-top: 10px;
        font-family: monospace;
        font-size: 11px;
        overflow-x: auto;
      }
      .rtc-et-pipe-node {
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        white-space: nowrap;
        font-weight: 600;
      }
      .rtc-et-pipe-node--worker {
        background: linear-gradient(135deg, #f59e0b, #f97316);
      }
      .rtc-et-pipe-node--crypto {
        background: linear-gradient(135deg, #10b981, #34d399);
      }
      .rtc-et-pipe-arrow {
        color: #94a3b8;
        font-weight: 700;
      }
      .rtc-et-matrix {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .rtc-et-matrix-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
      }
      .rtc-et-output {
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
      .rtc-et-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
  }

  _flags() {
    const safe = (fn) => {
      try { return fn(); } catch { return false; }
    };
    return {
      rtcRtpScriptTransform: safe(() => typeof RTCRtpScriptTransform !== 'undefined'),
      senderTransform: safe(() => typeof RTCRtpSender !== 'undefined' && 'transform' in RTCRtpSender.prototype),
      receiverTransform: safe(() => typeof RTCRtpReceiver !== 'undefined' && 'transform' in RTCRtpReceiver.prototype),
      createEncodedStreams: safe(() => typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.prototype.createEncodedStreams === 'function'),
      createEncodedAudioStreams: safe(() => typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.prototype.createEncodedAudioStreams === 'function'),
      encodedVideoFrame: safe(() => typeof RTCEncodedVideoFrame !== 'undefined'),
      encodedAudioFrame: safe(() => typeof RTCEncodedAudioFrame !== 'undefined'),
      trackProcessor: safe(() => typeof MediaStreamTrackProcessor !== 'undefined'),
      trackGenerator: safe(() => typeof MediaStreamTrackGenerator !== 'undefined'),
      videoFrame: safe(() => typeof VideoFrame !== 'undefined'),
      videoEncoder: safe(() => typeof VideoEncoder !== 'undefined'),
      videoDecoder: safe(() => typeof VideoDecoder !== 'undefined'),
      audioData: safe(() => typeof AudioData !== 'undefined'),
      webCrypto: safe(() => typeof crypto !== 'undefined' && !!crypto.subtle),
      worker: safe(() => typeof Worker !== 'undefined'),
    };
  }

  // ===================== Card 1：概念与演进 =====================

  _runConceptDemo() {
    const f = this._flags();
    const any = f.rtcRtpScriptTransform || f.senderTransform || f.createEncodedStreams;
    if (!any) {
      this._addLog('warn', '当前环境无 Insertable Streams 能力，仅展示概念说明与代码示例（jsdom 无 WebRTC）');
    } else {
      this._addLog('info', `Insertable Streams 能力可用：script=${f.rtcRtpScriptTransform} sender.transform=${f.senderTransform} legacy=${f.createEncodedStreams}`);
    }
    const info = `
===== WebRTC Insertable Streams 概念与演进 =====

【什么是 Insertable Streams（可插入流）】
  WebRTC Insertable Streams（W3C WebRTC 编码插入规范）允许 JavaScript
  在 RTP 编解码器输出（编码后帧）与 RTP 打包发送之间插入一段自定义
  处理流水线，对编码后的音视频帧做任意变换。典型用途：
    - 端到端加密（E2EE）视频会议（SFrame / AES-GCM）
    - AI 背景虚化 / 替换 / 美颜
    - 实时水印注入（版权保护）
    - 自定义转码（H.264 → VP8，或降分辨率）
    - 音频降噪（WebAssembly RNNoise / whisper.cpp）

【API 演进路线（关键！）】
  阶段 1：createEncodedStreams()（旧 API，Chrome 86-105）
    - RTCRtpSender.prototype.createEncodedStreams()
      返回 { readable: ReadableStream, writable: WritableStream }
    - RTCRtpReceiver.prototype.createEncodedStreams() 同理
    - 主线程直接处理，无 Worker 隔离
    - 已被规范废弃，但仍作为降级方案保留

  阶段 2：RTCEncodedTransform（过渡，Chrome 86-105）
    - RTCRtpSender.transform = new RTCEncodedTransform({ transform })
    - 类似 Web Streams API 的 TransformStream，主线程运行
    - 性能差（主线程阻塞），已废弃

  阶段 3：RTCRtpScriptTransform（新 API，Chrome 105+，规范方向）★
    - RTCRtpSender.transform = new RTCRtpScriptTransform(worker, name, options)
    - 处理逻辑跑在专用 Worker（DedicatedWorkerGlobalScope）
    - 主线程仅做绑定，不阻塞
    - Worker 内通过 self.onrtcrtpscripttransform 事件接收 transformer
    - transformer.readable / transformer.writable 是端到端流
    - 这是当前规范推荐的生产 API

【工作线程模型（RTCRtpScriptTransform）】
  主线程：
    const worker = new Worker('rtc-transform-worker.js');
    const transform = new RTCRtpScriptTransform(worker, 'encrypt', { key });
    sender.transform = transform;   // 绑定到发送端
    // 或 receiver.transform = transform;  // 绑定到接收端

  Worker（rtc-transform-worker.js）：
    self.onrtcrtpscripttransform = (event) => {
      const { transformer } = event;
      // transformer.name === 'encrypt'
      // transformer.options === { key }
      // 端到端管道：transformer.readable → 处理 → transformer.writable
      transformer.readable
        .pipeThrough(new TransformStream({ transform: frame => { /* ... */ } }))
        .pipeTo(transformer.writable);
    };

【与 WebCodecs 的区别】
  Insertable Streams（RTCRtpScriptTransform）：
    - 作用域：WebRTC RTP 管线（编解码后、RTP 打包前）
    - 处理对象：RTCEncodedVideoFrame / RTCEncodedAudioFrame（已编码）
    - 触发方式：sender.transform = ... 绑定后自动接管每帧
    - 典型场景：E2EE、水印、降噪
    - 帧已编码（H.264 NALU / VP8 / Opus），不可直接显示

  WebCodecs（VideoEncoder / VideoDecoder / VideoFrame）：
    - 作用域：通用编解码（不依赖 WebRTC）
    - 处理对象：VideoFrame（未编码）/ EncodedChunk（已编码）
    - 触发方式：显式 encode() / decode() 调用
    - 典型场景：自定义转码管线、视频编辑、流媒体
    - 可与 Insertable Streams 互转（Card 6）

  关系：两者互补，WebCodecs 处理「编解码」，
        Insertable Streams 处理「WebRTC 管线注入」。

【浏览器支持矩阵（2024-2026）】
  浏览器        RTCRtpScriptTransform  createEncodedStreams  RTCEncodedVideoFrame
  Chrome 105+   ✓ 新 API              ✓（降级用）           ✓（worker 内）
  Edge 105+     ✓ 新 API              ✓（降级用）           ✓（worker 内）
  Safari 17+    ✗ 暂不支持             ✗                     ✗
  Firefox       ✗ 暂不支持             ✗                     ✗
  移动 Chrome   ✓ 105+                ✓                     ✓

【实际能力检测演示】
  RTCRtpScriptTransform:    ${f.rtcRtpScriptTransform ? '✓' : '✗'} (Chrome 105+ / Edge 105+)
  sender.transform:         ${f.senderTransform ? '✓' : '✗'} (新 API 标志位)
  createEncodedStreams:     ${f.createEncodedStreams ? '✓' : '✗'} (旧 API，Chrome 86-105)
  RTCEncodedVideoFrame:     ${f.encodedVideoFrame ? '✓' : '✗'} (仅 worker 内可见)
  VideoFrame (WebCodecs):   ${f.videoFrame ? '✓' : '✗'} (Chrome 94+ / Safari 16.4+)
  WebCrypto subtle:         ${f.webCrypto ? '✓' : '✗'} (SFrame 加密依赖)

【常见陷阱】
  1. createEncodedStreams() 已废弃，新代码必须用 RTCRtpScriptTransform
  2. RTCEncodedVideoFrame 只在 Worker 内可见，主线程 typeof 永远 undefined
  3. Safari / Firefox 暂不支持，需服务端转码降级
  4. options 透传是结构化克隆，不能传函数 / DOM / 闭包
  5. 一个 RTCRtpScriptTransform 实例只能绑定一个 sender 或 receiver
  6. Worker 必须同源（CORS），不能用 blob: URL（部分浏览器限制）
`;
    this.setState({ conceptInfo: info });
    this._addLog('info', '概念与演进演示完成（API 三阶段演进 + 工作线程模型 + 浏览器矩阵）');
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const code = `// 阶段 3：RTCRtpScriptTransform（新 API，规范方向）★
// 主线程：创建 Worker + 绑定 transform
const worker = new Worker('rtc-transform-worker.js');
const sender = pc.getSenders().find(s => s.track?.kind === 'video');
sender.transform = new RTCRtpScriptTransform(worker, 'encrypt', { key });

// 阶段 1：createEncodedStreams()（旧 API，已废弃，降级用）
const { readable, writable } = sender.createEncodedStreams();
readable.pipeThrough(new TransformStream({
  transform: (frame, controller) => {
    // frame: RTCEncodedVideoFrame
    const data = new Uint8Array(frame.data);
    // ... 加密 / 水印 / 转码 ...
    frame.data = data.buffer;
    controller.enqueue(frame);
  }
})).pipeTo(writable);`;
    const card = new Card({
      title: '1. 概念与演进 —— Insertable Streams → RTCRtpScriptTransform',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['RTCRtpScriptTransform', f.rtcRtpScriptTransform],
          ['sender.transform', f.senderTransform],
        ]),
        h(Tag, { color: 'primary' }, '概念'),
      ),
      children: [
        s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
        h('p', { class: 'fs-sm text-secondary' },
          'WebRTC Insertable Streams（可插入流）允许 JS 在 RTP 编解码器输出与 RTP 打包之间插入自定义处理管线。API 三阶段演进：createEncodedStreams()（旧，Chrome 86-105）→ RTCEncodedTransform（过渡，主线程）→ RTCRtpScriptTransform（新，Worker 隔离，Chrome 105+，规范方向）。新 API 处理逻辑跑在 DedicatedWorkerGlobalScope，主线程仅做绑定不阻塞。与 WebCodecs 互补：WebCodecs 通用编解码，Insertable Streams 处理 WebRTC 管线注入。Safari/Firefox 暂不支持。',
        ),
        h('div', { class: 'rtc-et-pipeline' },
          h('span', { class: 'rtc-et-pipe-node' }, 'Encoder'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node rtc-et-pipe-node--worker' }, 'RTCRtpScriptTransform (Worker)'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node' }, 'RTP Packetizer'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node' }, 'Network'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行概念演示', { type: 'primary', size: 'sm', onClick: () => this._runConceptDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.conceptInfo || '（点击按钮查看概念与演进完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：transform 绑定 =====================

  _runTransformBindingDemo() {
    const f = this._flags();
    if (!f.rtcRtpScriptTransform) {
      this._addLog('warn', 'RTCRtpScriptTransform 不可用，跳过真实绑定（jsdom 无 WebRTC，真实浏览器需 Chrome 105+）');
    } else {
      try {
        const blob = new Blob([`self.onrtcrtpscripttransform = () => {};`], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        const t = new RTCRtpScriptTransform(worker, 'noop', { tag: 'demo' });
        this._addLog('info', `RTCRtpScriptTransform 实例化成功：name=${t.name || 'noop'}`);
        worker.terminate();
      } catch (err) {
        this._addLog('warn', `RTCRtpScriptTransform 实例化失败：${err && err.message}`);
      }
    }
    const info = `
===== transform 绑定：sender.transform / receiver.transform =====

【RTCRtpSender.transform 绑定（发送端）】
  // 从 RTCPeerConnection 取出视频 sender
  const sender = pc.getSenders().find(s => s.track?.kind === 'video');
  if (!sender) throw new Error('未找到视频 sender');

  // 创建 Worker（同源 .js 文件，不能用 blob: / data:）
  const worker = new Worker('transform-worker.js');

  // 创建 RTCRtpScriptTransform 实例
  // 构造签名：new RTCRtpScriptTransform(worker, name, options)
  //   worker   Worker 实例（DedicatedWorkerGlobalScope）
  //   name     字符串，传递给 worker 的 transformer.name（路由用）
  //   options  任意可结构化克隆的值，传递给 transformer.options
  const transform = new RTCRtpScriptTransform(worker, 'encrypt', {
    key: cryptoKeyBytes,   // ArrayBuffer / Uint8Array
    mode: 'aes-gcm',       // 任意配置
    sessionId: 42,
  });

  // 绑定到 sender（之后每帧编码后都会进 worker 处理）
  sender.transform = transform;

  // 解绑：置 null
  // sender.transform = null;

【RTCRtpReceiver.transform 绑定（接收端）】
  const receiver = pc.getReceivers().find(r => r.track?.kind === 'video');
  const decWorker = new Worker('transform-worker.js');
  receiver.transform = new RTCRtpScriptTransform(decWorker, 'decrypt', {
    key: cryptoKeyBytes,
    mode: 'aes-gcm',
  });
  // 接收端每帧解码前会先进 worker 解密

【RTCRtpScriptTransform 构造器签名】
  new RTCRtpScriptTransform(worker, name, options)

  参数：
    worker   Worker 实例（必须是 new Worker(url) 创建的 DedicatedWorker）
             - SharedWorker / ServiceWorker 不支持
             - 必须同源，blob: URL 在 Chrome 部分版本受限
    name     字符串，传递给 worker 内 event.transformer.name
             - 用于在 worker 内按 name 路由不同处理逻辑
             - 例：'encrypt' / 'decrypt' / 'watermark' / 'denoise'
    options  任意可结构化克隆的值
             - 传递给 worker 内 event.transformer.options
             - 不能传函数 / DOM 节点 / 闭包（结构化克隆会失败）
             - 典型：{ key: ArrayBuffer, iv: Uint8Array, config: {...} }

【options 透传机制（结构化克隆）】
  // 主线程
  const keyBytes = await crypto.subtle.exportKey('raw', cryptoKey);
  const t = new RTCRtpScriptTransform(worker, 'encrypt', {
    key: new Uint8Array(keyBytes),   // ✓ 可克隆
    iv: crypto.getRandomValues(new Uint8Array(12)),  // ✓
    sessionId: 42,                   // ✓
    config: { mode: 'gcm', aad: 'header' },  // ✓ 嵌套对象
    // callback: () => {},           // ✗ 函数不可克隆，抛 DataCloneError
    // element: document.body,       // ✗ DOM 不可克隆
  });

  // Worker 内（event.transformer.options 拿到的是克隆副本）
  self.onrtcrtpscripttransform = (event) => {
    const { transformer } = event;
    console.log(transformer.name);     // 'encrypt'
    console.log(transformer.options);  // { key: Uint8Array, iv: Uint8Array, ... }
  };

【一个 sender 只能绑定一个 transform】
  sender.transform = t1;
  sender.transform = t2;  // 覆盖 t1，t1 不再被调用
  // 不能叠加多个 transform（如需串联用 worker 内 pipeThrough 多级）

【双向绑定（发送 + 接收）】
  // 同一 RTCPeerConnection 既发送又接收，需分别绑定
  const sendTransform = new RTCRtpScriptTransform(worker, 'encrypt', { key });
  const recvTransform = new RTCRtpScriptTransform(worker, 'decrypt', { key });
  pc.getSenders().forEach(s => { if (s.track) s.transform = sendTransform; });
  pc.getReceivers().forEach(r => { if (r.track) r.transform = recvTransform; });

【绑定时机】
  - 必须在 sender.track 已存在后绑定（addTrack / addTransceiver 之后）
  - 建议 in-negotiation 完成后绑定，避免 SDP 重协商丢失
  - 绑定后所有新编码帧都进 worker，已 in-flight 的帧不受影响

【浏览器支持】
  RTCRtpScriptTransform:  ${f.rtcRtpScriptTransform ? '✓' : '✗'} (Chrome 105+ / Edge 105+)
  sender.transform:       ${f.senderTransform ? '✓' : '✗'} (新 API 标志位)
  receiverTransform:      ${f.receiverTransform ? '✓' : '✗'} (同 sender.transform)

【常见陷阱】
  1. options 传函数会抛 DataCloneError（结构化克隆不支持）
  2. Worker 必须同源 .js 文件，blob: URL 在 Chrome 部分版本受限
  3. 绑定后修改 options 无效（options 在构造时一次性透传）
  4. 一个 transform 实例只能绑一个 sender/receiver，不能复用
  5. 绑定时机太早（track 未就绪）会静默失败
`;
    this.setState({ transformBindingInfo: info });
    this._addLog('info', 'transform 绑定演示完成（构造器签名 + options 透传 + 双向绑定）');
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const code = `// 主线程：创建 Worker + 构造 RTCRtpScriptTransform + 绑定
const sender = pc.getSenders().find(s => s.track?.kind === 'video');
const worker = new Worker('transform-worker.js');

// 关键签名：new RTCRtpScriptTransform(worker, name, options)
//   name     → worker 内 event.transformer.name（路由用）
//   options  → worker 内 event.transformer.options（结构化克隆透传）
const transform = new RTCRtpScriptTransform(worker, 'encrypt', {
  key: new Uint8Array(keyBytes),   // ArrayBuffer / TypedArray 可克隆
  mode: 'aes-gcm',
  sessionId: 42,
});

// 绑定到 sender（编码后每帧进 worker 处理）
sender.transform = transform;

// 接收端同理
const receiver = pc.getReceivers().find(r => r.track?.kind === 'video');
receiver.transform = new RTCRtpScriptTransform(worker, 'decrypt', {
  key: new Uint8Array(keyBytes),
  mode: 'aes-gcm',
});`;
    const card = new Card({
      title: '2. transform 绑定 —— RTCRtpSender/Receiver.transform + 构造器',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['RTCRtpScriptTransform', f.rtcRtpScriptTransform],
          ['sender.transform', f.senderTransform],
          ['receiver.transform', f.receiverTransform],
        ]),
        h(Tag, { color: 'primary' }, '绑定'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'RTCRtpSender.transform / RTCRtpReceiver.transform 绑定 RTCRtpScriptTransform 实例。构造签名 new RTCRtpScriptTransform(worker, name, options)：worker 是 DedicatedWorker 实例（同源 .js），name 字符串用于 worker 内路由，options 任意可结构化克隆的值透传给 transformer.options。options 不能传函数 / DOM / 闭包（DataCloneError）。一个 transform 实例只能绑一个 sender 或 receiver，绑定后所有新编码帧自动进 worker。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行绑定演示', { type: 'primary', size: 'sm', onClick: () => this._runTransformBindingDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.transformBindingInfo || '（点击按钮查看 transform 绑定完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：Worker 端事件 =====================

  _runWorkerEventDemo() {
    const f = this._flags();
    if (!f.worker) {
      this._addLog('warn', 'Worker 不可用，跳过 worker 事件演示');
    } else {
      // 真实创建一个 Worker 并发送 onrtcrtpscripttransform 自检（jsdom 不会触发）
      try {
        const blob = new Blob([
          `self.onrtcrtpscripttransform = (event) => {
            const { transformer } = event;
            self.postMessage({ name: transformer.name, hasReadable: !!transformer.readable, hasWritable: !!transformer.writable });
            transformer.readable.pipeTo(transformer.writable).catch(() => {});
          };`
        ], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = (e) => {
          this._addLog('info', `Worker 自检回执：${JSON.stringify(e.data)}`);
          worker.terminate();
        };
        worker.onerror = (e) => {
          this._addLog('warn', `Worker 错误：${e.message || 'unknown'}`);
        };
        this._addLog('info', 'Worker 已创建，等待 onrtcrtpscripttransform 事件（jsdom 不会真实触发，真实浏览器由 RTCRtpScriptTransform 触发）');
      } catch (err) {
        this._addLog('warn', `Worker 创建失败：${err && err.message}`);
      }
    }
    const info = `
===== Worker 端事件：onrtcrtpscripttransform + transformer =====

【self.onrtcrtpscripttransform 事件】
  // transform-worker.js（DedicatedWorkerGlobalScope）
  self.onrtcrtpscripttransform = (event) => {
    const { transformer } = event;
    // transformer 是 RTCRtpScriptTransformer 实例
    //   .name     主线程构造时传入的 name（'encrypt' / 'decrypt'）
    //   .options  主线程构造时传入的 options（结构化克隆副本）
    //   .readable  ReadableStream<RTCEncodedFrame>  编码后帧输入流
    //   .writable  WritableStream<RTCEncodedFrame>  处理后帧输出流
    console.log(transformer.name, transformer.options);
  };

  // 事件触发时机：主线程 new RTCRtpScriptTransform(worker, name, options)
  //               并绑定到 sender/receiver 后，引擎在 worker 内派发此事件
  // 每个绑定对应一次事件（一个 worker 可处理多个绑定）

【transformer.readable / writable 端到端管道】
  // readable 是编码后帧的输入流（每帧一个 RTCEncodedVideoFrame / AudioFrame）
  // writable 是处理后帧的输出流（必须写入，否则对方收不到画面/声音）
  // 端到端管道：readable → [你的处理] → writable

  self.onrtcrtpscripttransform = (event) => {
    const { transformer } = event;
    const { readable, writable } = transformer;

    // 最简透传：原样转发（不做任何处理）
    readable.pipeTo(writable);
  };

【pipeThrough TransformStream 处理每帧】
  self.onrtcrtpscripttransform = (event) => {
    const { transformer } = event;
    const { name, options, readable, writable } = transformer;

    const transformStream = new TransformStream({
      transform: (frame, controller) => {
        // frame: RTCEncodedVideoFrame 或 RTCEncodedAudioFrame
        //   .type       'key' / 'delta'（视频）/ 'key' / 'delta'（音频）
        //   .timestamp  帧时间戳（DOMHighResTimeStamp，微秒）
        //   .data       ArrayBuffer（编码后字节，H.264 NALU / VP8 / Opus）
        //   .getMetadata()  返回 { synchronizationSource, contributingSources, ... }
        //   .getContributingSources()  返回 CSRC 数组

        if (name === 'encrypt') {
          const encrypted = encryptFrame(frame, options.key);
          frame.data = encrypted.buffer;   // 修改帧 data
        } else if (name === 'watermark') {
          injectWatermark(frame);
        }
        // 必须enqueue，否则下游收不到
        controller.enqueue(frame);
      },
      flush: () => {
        console.log('transformer 结束（sender/receiver 解绑或关闭）');
      }
    });

    // 端到端管道：readable → transformStream → writable
    readable
      .pipeThrough(transformStream)
      .pipeTo(writable)
      .catch(err => console.error('管道错误:', err));
  };

【按 name 路由不同处理逻辑】
  self.onrtcrtpscripttransform = (event) => {
    const { transformer } = event;
    switch (transformer.name) {
      case 'encrypt':  setupEncrypt(transformer);  break;
      case 'decrypt':  setupDecrypt(transformer);  break;
      case 'watermark': setupWatermark(transformer); break;
      case 'denoise':  setupDenoise(transformer);  break;
      default:
        // 未知 name：原样透传
        transformer.readable.pipeTo(transformer.writable);
    }
  };

【多绑定共用一个 Worker】
  // 主线程：一个 worker 处理多个 sender/receiver
  const worker = new Worker('transform-worker.js');
  pc.getSenders().forEach((s, i) => {
    if (s.track) {
      s.transform = new RTCRtpScriptTransform(worker, 'encrypt', { sessionId: i, key });
    }
  });
  // worker 内每个绑定触发一次 onrtcrtpscripttransform，互不干扰

【ReadableStream / WritableStream 错误传播】
  // pipeThrough / pipeTo 的错误会沿管道传播
  // worker 内 transform 抛异常 → readable cancel → writable abort
  // 主线程可通过 transform.addEventListener('error', ...) 监听
  //   （RTCRtpScriptTransform 继承 EventTarget）

  // 推荐：transform 内 try/catch，异常帧原样透传避免黑屏
  transform: (frame, controller) => {
    try {
      // ... 处理 ...
      controller.enqueue(frame);
    } catch (err) {
      console.error('帧处理失败，原样转发:', err);
      controller.enqueue(frame);  // 兜底
    }
  }

【backpressure 与流量控制】
  // ReadableStream / WritableStream 自带背压
  // transform 函数返回 Promise 时，上游会等待（避免帧堆积）
  // 异步处理（如 WASM 降噪）：
  transform: async (frame, controller) => {
    const processed = await wasmProcess(frame.data);
    frame.data = processed.buffer;
    controller.enqueue(frame);
  }

【浏览器支持】
  Worker 可用:            ${f.worker ? '✓' : '✗'}
  RTCRtpScriptTransform:  ${f.rtcRtpScriptTransform ? '✓' : '✗'} (事件由引擎派发)

【常见陷阱】
  1. 必须写入 writable，否则对方收不到画面（最常见 bug）
  2. transform 抛异常会断流，务必 try/catch 兜底
  3. 一个 worker 可处理多个绑定，但每个绑定的 readable/writable 独立
  4. options 是构造时一次性透传，运行时改 options 无效
  5. worker 内不能 import 主线程模块（需 importScripts 或 ESM worker）
  6. 关键帧（type='key'）处理错误会导致解码端长时间花屏
`;
    this.setState({ workerEventInfo: info });
    this._addLog('info', 'Worker 端事件演示完成（onrtcrtpscripttransform + readable/writable 管道）');
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const code = `// transform-worker.js（运行在 DedicatedWorkerGlobalScope）
self.onrtcrtpscripttransform = (event) => {
  const { transformer } = event;
  const { name, options, readable, writable } = transformer;

  // 按 name 路由
  const transformStream = new TransformStream({
    transform: (frame, controller) => {
      // frame: RTCEncodedVideoFrame / RTCEncodedAudioFrame
      //   .type       'key' / 'delta'
      //   .timestamp  微秒时间戳
      //   .data       ArrayBuffer（编码后字节）
      //   .getMetadata()  { synchronizationSource, contributingSources, ... }
      if (name === 'encrypt') {
        frame.data = encrypt(frame.data, options.key).buffer;
      }
      controller.enqueue(frame);  // 必须enqueue，否则下游收不到
    },
  });

  // 端到端管道：readable → TransformStream → writable
  readable
    .pipeThrough(transformStream)
    .pipeTo(writable)
    .catch(err => console.error('管道错误:', err));
};`;
    const card = new Card({
      title: '3. Worker 端事件 —— onrtcrtpscripttransform + readable/writable',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Worker', f.worker],
          ['RTCRtpScriptTransform', f.rtcRtpScriptTransform],
        ]),
        h(Tag, { color: 'primary' }, 'Worker'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Worker 内 self.onrtcrtpscripttransform 事件接收 RTCRtpScriptTransformer 实例：transformer.name（主线程构造时传入的路由名）、transformer.options（结构化克隆透传）、transformer.readable（ReadableStream<RTCEncodedFrame> 编码后帧输入）、transformer.writable（WritableStream 处理后帧输出）。端到端管道：readable.pipeThrough(new TransformStream({ transform })).pipeTo(writable)。transform 函数处理每帧后必须 controller.enqueue(frame)，否则下游收不到画面。',
        ),
        h('div', { class: 'rtc-et-pipeline' },
          h('span', { class: 'rtc-et-pipe-node' }, 'readable'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node rtc-et-pipe-node--worker' }, 'TransformStream'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node' }, 'writable'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Worker 事件演示', { type: 'primary', size: 'sm', onClick: () => this._runWorkerEventDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.workerEventInfo || '（点击按钮查看 Worker 端事件完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：EncodedFrame 接口 =====================

  _runEncodedFrameDemo() {
    const f = this._flags();
    if (!f.encodedVideoFrame && !f.encodedAudioFrame) {
      this._addLog('warn', 'RTCEncodedVideoFrame/AudioFrame 不可用（仅 worker 内可见，jsdom 不实现）');
    } else {
      this._addLog('info', `RTCEncodedVideoFrame=${f.encodedVideoFrame} AudioFrame=${f.encodedAudioFrame}`);
    }
    const info = `
===== EncodedFrame 接口：RTCEncodedVideoFrame / RTCEncodedAudioFrame =====

【RTCEncodedVideoFrame 接口（worker 内）】
  // 仅在 Worker（onrtcrtpscripttransform 的 transform 函数参数）内可见
  // 主线程 typeof RTCEncodedVideoFrame === 'undefined'
  interface RTCEncodedVideoFrame {
    readonly type: 'key' | 'delta';       // 帧类型（关键帧 / 增量帧）
    readonly timestamp: number;            // DOMHighResTimeStamp，微秒
    readonly data: ArrayBuffer;            // 编码后字节（H.264 NALU / VP8 / AV1）
    getMetadata(): RTCEncodedVideoFrameMetadata;
    getContributingSources(): number[];    // CSRC 数组（32-bit SSRC）
  }

  // data 是可写的：frame.data = newArrayBuffer 可修改帧内容
  //   修改后必须 enqueue 到下游，否则不生效

【RTCEncodedVideoFrameMetadata】
  interface RTCEncodedVideoFrameMetadata {
    synchronizationSource: number;         // 32-bit SSRC（同步源）
    contributingSources: number[];         // CSRC 数组（贡献源）
    frameId?: number;                      // 帧序号（部分实现）
    dependencies?: number[];               // 依赖的帧序号（用于分层编码）
    width?: number;                        // 帧宽度（部分实现）
    height?: number;                       // 帧高度（部分实现）
    spatialIndex?: number;                 // 空间层索引（SVC）
    temporalIndex?: number;                // 时间层索引（SVC）
  }

【RTCEncodedAudioFrame 接口（worker 内）】
  interface RTCEncodedAudioFrame {
    readonly type: 'key' | 'delta';        // 音频通常是 'delta'
    readonly timestamp: number;             // 微秒时间戳
    readonly data: ArrayBuffer;             // 编码后字节（Opus / AAC）
    getMetadata(): RTCEncodedAudioFrameMetadata;
    getContributingSources(): number[];
  }

  interface RTCEncodedAudioFrameMetadata {
    synchronizationSource: number;
    contributingSources: number[];
    frameId?: number;
    // 音频无 width/height/spatialIndex 等
  }

【读取帧数据（典型 transform）】
  // worker 内
  transform: (frame, controller) => {
    // 读取元数据
    const meta = frame.getMetadata();
    console.log('SSRC:', meta.synchronizationSource);
    console.log('CSRC:', frame.getContributingSources());
    console.log('type:', frame.type, '  timestamp:', frame.timestamp);

    // 读取字节
    const bytes = new Uint8Array(frame.data);
    console.log('frame bytes:', bytes.length, 'first byte:', bytes[0]);

    // H.264 NALU 起始码 0x00 0x00 0x00 0x01
    // Opus 帧: TOC byte + payload
    // VP8: 3-byte frame tag + payload

    controller.enqueue(frame);
  }

【修改帧 data（加密 / 水印 / 转码）】
  transform: (frame, controller) => {
    const input = new Uint8Array(frame.data);
    const output = new Uint8Array(input.length + 16);  // 加密后多 16 字节

    // 1. 加密：AES-GCM 加密 input → output
    // 2. 水印：在 NALU SEI 中注入水印字节
    // 3. 转码：H.264 → VP8（需 WebCodecs VideoDecoder/Encoder）

    // 关键：必须赋值新 ArrayBuffer
    frame.data = output.buffer;

    controller.enqueue(frame);
  }

【关键帧与增量帧处理差异】
  // type === 'key'：关键帧（I 帧），可独立解码
  //   - 加密时可用更大 nonce / 独立密钥
  //   - 水印注入通常只在关键帧（避免每帧开销）
  //   - 转码时关键帧是随机访问点
  // type === 'delta'：增量帧（P/B 帧），依赖前序帧
  //   - 不能丢弃（会导致后续 delta 解码失败）
  //   - 加密 nonce 必须顺序递增，避免重放

  transform: (frame, controller) => {
    if (frame.type === 'key') {
      // 关键帧特殊处理
      injectWatermark(frame);
    }
    // 所有帧统一加密
    encryptFrame(frame, key, nonce++);
    controller.enqueue(frame);
  }

【getContributingSources() 与混音场景】
  // 音频混音器（mixer）会把多个 SSRC 混入一帧
  // getContributingSources() 返回 CSRC 数组（贡献源的 SSRC）
  // 加密时需保留 CSRC 元数据（解密端用于识别发言者）

  transform: (frame, controller) => {
    const csrcs = frame.getContributingSources();
    if (csrcs.length > 1) {
      console.log('混音帧，来源:', csrcs);
    }
    encryptFrame(frame);
    controller.enqueue(frame);
  }

【timestamp 与同步】
  // timestamp 是微秒级（1e6 = 1 秒）
  // 编码器原始时间戳，可用于：
  //   - 音视频同步（A/V sync）
  //   - 抖动计算（与 arrival time 差值）
  //   - 自定义缓冲策略
  // 注意：timestamp 不一定单调（B 帧重排），需 frameId 配合

【浏览器支持】
  RTCEncodedVideoFrame:  ${f.encodedVideoFrame ? '✓' : '✗'} (仅 worker 内可见，Chrome 86+)
  RTCEncodedAudioFrame:  ${f.encodedAudioFrame ? '✓' : '✗'} (仅 worker 内可见，Chrome 86+)

【常见陷阱】
  1. RTCEncodedVideoFrame 仅 worker 内可见，主线程无法构造或访问
  2. 修改 data 必须赋值 ArrayBuffer，不能直接改 Uint8Array（不生效）
  3. data 长度变化时需重新分配 ArrayBuffer（不能复用原 buffer）
  4. 关键帧处理错误会导致解码端长时间花屏（直到下一个关键帧）
  5. timestamp 微秒级，与 Date.now()（毫秒）单位不同
  6. getMetadata() 返回的 frameId 部分实现才有，不可依赖
`;
    this.setState({ encodedFrameInfo: info });
    this._addLog('info', 'EncodedFrame 接口演示完成（Video/Audio Frame + metadata + CSRC）');
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const code = `// worker 内 transform 函数处理 RTCEncodedVideoFrame
transform: (frame, controller) => {
  // frame: RTCEncodedVideoFrame
  console.log(frame.type);            // 'key' | 'delta'
  console.log(frame.timestamp);       // 微秒
  console.log(frame.data);            // ArrayBuffer（编码后字节）

  const meta = frame.getMetadata();
  console.log(meta.synchronizationSource);   // 32-bit SSRC
  console.log(meta.width, meta.height);      // 帧宽高（部分实现）

  const csrcs = frame.getContributingSources();
  console.log(csrcs);                 // CSRC 数组（混音场景）

  // 修改帧 data（加密 / 水印 / 转码）
  const input = new Uint8Array(frame.data);
  const output = new Uint8Array(input.length + 16);
  // ... 处理 ...
  frame.data = output.buffer;   // 必须赋值 ArrayBuffer

  controller.enqueue(frame);    // 必须 enqueue，否则下游收不到
};`;
    const card = new Card({
      title: '4. EncodedFrame 接口 —— RTCEncodedVideoFrame / AudioFrame',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['RTCEncodedVideoFrame', f.encodedVideoFrame],
          ['RTCEncodedAudioFrame', f.encodedAudioFrame],
        ]),
        h(Tag, { color: 'primary' }, 'Frame 接口'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'RTCEncodedVideoFrame / RTCEncodedAudioFrame 接口（仅 worker 内可见）：type（key/delta）、timestamp（微秒）、data（ArrayBuffer 编码后字节）、getMetadata()（返回 synchronizationSource/contributingSources/frameId/width/height/spatialIndex/temporalIndex 等）、getContributingSources()（CSRC 数组）。data 可写：frame.data = newArrayBuffer 修改帧内容，修改后必须 enqueue。关键帧（key）处理错误会导致解码端长时间花屏。timestamp 微秒级，与 Date.now()（毫秒）单位不同。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Frame 接口演示', { type: 'primary', size: 'sm', onClick: () => this._runEncodedFrameDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.encodedFrameInfo || '（点击按钮查看 EncodedFrame 接口完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：SFrame 端到端加密实战 =====================

  _runSframeDemo() {
    const f = this._flags();
    if (!f.webCrypto) {
      this._addLog('warn', 'crypto.subtle 不可用，SFrame 加密演示仅展示代码（jsdom 无 WebCrypto）');
    } else {
      // 真实生成 AES-GCM 密钥并导出（验证 WebCrypto 可用）
      try {
        crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        ).then((key) => {
          this._addLog('info', 'AES-GCM 256 密钥生成成功（WebCrypto 可用，SFrame 加密管线可运行）');
          return crypto.subtle.exportKey('raw', key);
        }).then((raw) => {
          this._addLog('info', `密钥导出成功，长度=${raw.byteLength} 字节（可透传给 RTCRtpScriptTransform）`);
        }).catch((err) => {
          this._addLog('warn', `WebCrypto 密钥操作失败：${err && err.message}`);
        });
      } catch (err) {
        this._addLog('warn', `WebCrypto 异常：${err && err.message}`);
      }
    }
    const info = `
===== SFrame 端到端加密实战 =====

【SFrame 是什么】
  SFrame（Secure Frame）是 IETF 草案 draft-omara-sframe，专为实时视频
  会议设计的端到端加密（E2EE）方案。特点：
    - 在 RTP 编码后帧级别加密（非包级别 SRTP）
    - 与 SFU（选择性转发单元）兼容：SFU 不需解密即可转发
    - 加密元数据嵌入帧头，不影响 RTP 打包
    - 支持密钥轮换、多发言者混音加密

  与 SRTP 的区别：
    SRTP：传输层加密（SFU 需解密再转发，非端到端）
    SFrame：帧层加密（SFU 不解密，真正端到端）

【密钥协商（ECDH + DTLS）】
  // 1. 每个客户端生成 ECDH 密钥对
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  // 2. 通过 DataChannel 交换公钥（已通过 DTLS-SRTP 加密）
  const pubKeyBytes = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  dc.send(JSON.stringify({ type: 'pubkey', data: Array.from(new Uint8Array(pubKeyBytes)) }));

  // 3. 收到对方公钥后，派生共享密钥
  const theirPubKey = await crypto.subtle.importKey('raw', theirPubBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPubKey },
    keyPair.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // 4. 导出 raw key 透传给 RTCRtpScriptTransform
  const rawKeyBytes = await crypto.subtle.exportKey('raw', sharedKey);
  const keyBytes = new Uint8Array(rawKeyBytes);

【AES-GCM 加密 transform（worker 内）】
  // encrypt-worker.js
  let nonceCounter = 0;  // 顺序递增的 nonce 计数器

  self.onrtcrtpscripttransform = (event) => {
    const { transformer } = event;
    if (transformer.name !== 'encrypt') return;

    const { key, ssrc } = transformer.options;  // key: Uint8Array

    const transformStream = new TransformStream({
      transform: async (frame, controller) => {
        // 1. 生成 nonce：ssrc(4) + counter(8) = 12 字节（AES-GCM 推荐）
        const nonce = new Uint8Array(12);
        new DataView(nonce.buffer).setUint32(0, ssrc, false);
        new DataView(nonce.buffer).setBigUint64(4, BigInt(nonceCounter++), false);

        // 2. 准备明文：SFrame 头 + 帧数据
        const plaintext = new Uint8Array(frame.data);

        // 3. AES-GCM 加密
        //    associatedData: SFrame 头（含 ssrc / counter / frame type）
        const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
        const sframeHeader = buildSFrameHeader(ssrc, nonceCounter, frame.type);
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: nonce, additionalData: sframeHeader },
          cryptoKey,
          plaintext
        ));
        // ciphertext 末尾含 16 字节 GCM tag

        // 4. 输出：SFrame 头 + 密文（含 tag）
        const output = new Uint8Array(sframeHeader.length + ciphertext.length);
        output.set(sframeHeader, 0);
        output.set(ciphertext, sframeHeader.length);
        frame.data = output.buffer;

        controller.enqueue(frame);
      }
    });

    transformer.readable.pipeThrough(transformStream).pipeTo(transformer.writable);
  };

【AES-GCM 解密 transform（worker 内）】
  self.onrtcrtpscripttransform = (event) => {
    const { transformer } = event;
    if (transformer.name !== 'decrypt') return;

    const { key, ssrc } = transformer.options;

    const transformStream = new TransformStream({
      transform: async (frame, controller) => {
        const input = new Uint8Array(frame.data);

        // 1. 解析 SFrame 头
        const headerLen = 12;  // ssrc(4) + counter(8)
        const sframeHeader = input.slice(0, headerLen);
        const ciphertext = input.slice(headerLen);

        // 2. 重建 nonce
        const nonce = sframeHeader.slice();  // 复制 header 作为 nonce 基础

        // 3. AES-GCM 解密（GCM 自动校验 tag）
        const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
        try {
          const plaintext = new Uint8Array(await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: nonce, additionalData: sframeHeader },
            cryptoKey,
            ciphertext
          ));
          frame.data = plaintext.buffer;
          controller.enqueue(frame);
        } catch (err) {
          // GCM tag 校验失败：丢帧（密钥错误 / 篡改 / nonce 错位）
          console.warn('解密失败，丢帧:', err);
          // 不 enqueue 即丢帧
        }
      }
    });

    transformer.readable.pipeThrough(transformStream).pipeTo(transformer.writable);
  };

【nonce 管理（关键！）】
  - AES-GCM 要求同一密钥下 nonce 不重复，否则安全性崩溃
  - 实时场景推荐：ssrc(4 字节) + 单调递增 counter(8 字节) = 12 字节 nonce
  - counter 必须持久化（worker 重启后继续递增）
  - 每个 SSRC 独立计数器（避免多流冲突）
  - 密钥轮换时重置 counter（新密钥从 0 开始）
  - 绝不能用 Math.random() / crypto.getRandomValues() 作 nonce（无法解密端重建）

【密钥轮换（forward secrecy）】
  // 每 N 帧或每 T 秒轮换密钥
  let frameCount = 0;
  let currentKey = initialKey;

  transform: async (frame, controller) => {
    if (frameCount++ % 1000 === 0) {
      currentKey = await rotateKey(currentKey);  // HKDF 派生新密钥
      // 通过 DataChannel 通知对端新密钥 ID
    }
    // ... 用 currentKey 加密 ...
  }

  // HKDF 派生：oldKey → newKey
  async function rotateKey(oldKey) {
    const baseKey = await crypto.subtle.importKey('raw', oldKey, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('sframe-rotate') },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

【与 Web Crypto 协同】
  - crypto.subtle.generateKey / importKey / exportKey：密钥管理
  - crypto.subtle.deriveKey（ECDH / HKDF）：密钥协商与轮换
  - crypto.subtle.encrypt / decrypt（AES-GCM）：帧加密解密
  - crypto.getRandomValues：生成 salt / IV（nonce 不可用随机！）
  - 注意：crypto.subtle 是异步，transform 函数需 async（背压自动生效）

【主线程绑定（发送 + 接收双向）】
  const encWorker = new Worker('encrypt-worker.js');
  const decWorker = new Worker('encrypt-worker.js');  // 独立 worker 解耦

  pc.getSenders().forEach(s => {
    if (s.track) {
      s.transform = new RTCRtpScriptTransform(encWorker, 'encrypt', { key: rawKey, ssrc: s.ssrc });
    }
  });
  pc.getReceivers().forEach(r => {
    if (r.track) {
      r.transform = new RTCRtpScriptTransform(decWorker, 'decrypt', { key: rawKey, ssrc: r.ssrc });
    }
  });

【浏览器支持】
  WebCrypto subtle:      ${f.webCrypto ? '✓' : '✗'} (SFrame 加密依赖)
  RTCRtpScriptTransform: ${f.rtcRtpScriptTransform ? '✓' : '✗'} (绑定管线)

【常见陷阱】
  1. nonce 重复会致命（AES-GCM 安全性崩溃），必须单调递增
  2. crypto.subtle 是异步，transform 需 async，否则竞态
  3. GCM tag 校验失败必须丢帧，不能转发错误数据（会花屏）
  4. 密钥协商必须走 DataChannel（已 DTLS 加密），不能走信令明文
  5. SFU 不解密 SFrame，但需识别 SFrame 头才能正确转发（部分老 SFU 不支持）
  6. 密钥轮换时新旧密钥需重叠窗口（避免切换瞬间丢帧）
`;
    this.setState({ sframeInfo: info });
    this._addLog('info', 'SFrame 端到端加密演示完成（ECDH 协商 + AES-GCM + nonce 管理）');
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const code = `// 主线程：ECDH 协商 + 绑定加密 transform
const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
);
// 通过 DataChannel 交换公钥后派生共享密钥
const sharedKey = await crypto.subtle.deriveKey(
  { name: 'ECDH', public: theirPubKey },
  keyPair.privateKey,
  { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
);
const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', sharedKey));

// 绑定到 sender（每帧加密）
const encWorker = new Worker('encrypt-worker.js');
sender.transform = new RTCRtpScriptTransform(encWorker, 'encrypt', {
  key: rawKey, ssrc: sender.ssrc
});

// encrypt-worker.js 内：AES-GCM 加密每帧
let nonceCounter = 0;
self.onrtcrtpscripttransform = (event) => {
  const { transformer } = event;
  if (transformer.name !== 'encrypt') return;
  transformer.readable.pipeThrough(new TransformStream({
    transform: async (frame, controller) => {
      const nonce = new Uint8Array(12);
      new DataView(nonce.buffer).setBigUint64(4, BigInt(nonceCounter++), false);
      const cryptoKey = await crypto.subtle.importKey('raw', transformer.options.key, 'AES-GCM', false, ['encrypt']);
      const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce }, cryptoKey, frame.data);
      frame.data = cipher;
      controller.enqueue(frame);
    }
  })).pipeTo(transformer.writable);
};`;
    const card = new Card({
      title: '5. SFrame 端到端加密实战 —— AES-GCM + nonce 管理',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['WebCrypto', f.webCrypto],
          ['RTCRtpScriptTransform', f.rtcRtpScriptTransform],
        ]),
        h(Tag, { color: 'success' }, 'E2EE'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'SFrame（Secure Frame，IETF draft-omara-sframe）专为实时视频会议设计的端到端加密方案：在 RTP 编码后帧级别加密（非包级别 SRTP），与 SFU 兼容（SFU 不解密即可转发）。密钥协商用 ECDH（P-256）通过 DataChannel 交换公钥派生共享密钥，AES-GCM 256 加密每帧。nonce 管理：ssrc(4) + 单调递增 counter(8) = 12 字节，重复 nonce 会致命（AES-GCM 安全性崩溃）。crypto.subtle 异步，transform 需 async。GCM tag 校验失败必须丢帧。密钥轮换用 HKDF 派生 + 重叠窗口。',
        ),
        h('div', { class: 'rtc-et-pipeline' },
          h('span', { class: 'rtc-et-pipe-node' }, 'Encoder'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node rtc-et-pipe-node--crypto' }, 'AES-GCM 加密'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node' }, 'RTP / SFU'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node rtc-et-pipe-node--crypto' }, 'AES-GCM 解密'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node' }, 'Decoder'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 SFrame 加密演示', { type: 'primary', size: 'sm', onClick: () => this._runSframeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.sframeInfo || '（点击按钮查看 SFrame 端到端加密完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：与 WebCodecs 互转 =====================

  _runWebCodecsDemo() {
    const f = this._flags();
    if (!f.videoFrame || !f.videoDecoder || !f.videoEncoder) {
      this._addLog('warn', `WebCodecs 不完整：VideoFrame=${f.videoFrame} Decoder=${f.videoDecoder} Encoder=${f.videoEncoder}，互转演示仅展示代码`);
    } else {
      this._addLog('info', `WebCodecs 齐备：VideoFrame=${f.videoFrame} Decoder/Encoder=${f.videoDecoder}/${f.videoEncoder}，可运行互转管线`);
    }
    const info = `
===== RTCEncodedVideoFrame ↔ VideoFrame 互转 =====

【为什么要互转】
  RTCEncodedVideoFrame 是「已编码」帧（H.264 NALU / VP8），不可直接显示。
  VideoFrame（WebCodecs）是「未编码」原始帧（YUV / RGB），可显示 / 处理。
  互转场景：
    - 自定义转码：H.264 → VP8（解码后重编码）
    - 实时背景虚化：解码 → Canvas 处理 → 重编码
    - 视频分析：解码后送 AI 模型（人脸检测 / 姿态估计）
    - 多路转码：一路输入 → 多路不同编码输出

【RTCEncodedVideoFrame → EncodedVideoChunk → VideoFrame（解码）】
  // worker 内
  // 1. RTCEncodedVideoFrame → EncodedVideoChunk（WebCodecs 已编码帧）
  function encodedFrameToChunk(frame) {
    return new EncodedVideoChunk({
      type: frame.type === 'key' ? 'key' : 'delta',
      timestamp: frame.timestamp,
      data: frame.data,   // ArrayBuffer 直接复用
    });
  }

  // 2. EncodedVideoChunk → VideoFrame（通过 VideoDecoder）
  let decoder = new VideoDecoder({
    output: (videoFrame) => {
      // videoFrame: VideoFrame（未编码，可显示 / Canvas 处理）
      processVideoFrame(videoFrame);
      videoFrame.close();  // 必须关闭释放内存！
    },
    error: (e) => console.error('解码错误:', e),
  });
  decoder.configure({
    codec: 'avc1.42E01E',  // H.264 Baseline 3.0
    codedWidth: 1280,
    codedHeight: 720,
  });
  decoder.decode(encodedFrameToChunk(frame));

【VideoFrame → EncodedVideoChunk → RTCEncodedVideoFrame（重编码）】
  // 1. VideoFrame → EncodedVideoChunk（通过 VideoEncoder）
  let encoder = new VideoEncoder({
    output: (chunk, meta) => {
      // chunk: EncodedVideoChunk
      // 重封装为 RTCEncodedVideoFrame 写回 writable
      const newFrame = wrapAsEncodedFrame(chunk, meta);
      controller.enqueue(newFrame);
    },
    error: (e) => console.error('编码错误:', e),
  });
  encoder.configure({
    codec: 'vp8',  // 转码为 VP8
    width: 1280,
    height: 720,
    bitrate: 1_000_000,
  });
  encoder.encode(processedVideoFrame, { keyFrame: frame.type === 'key' });

【完整转码管线：H.264 → 背景虚化 → VP8】
  // worker 内：H.264 输入 → 解码 → Canvas 虚化 → VP8 编码 → 输出
  self.onrtcrtpscripttransform = (event) => {
    const { transformer } = event;
    const { readable, writable } = transformer;

    const decoder = new VideoDecoder({
      output: (vframe) => {
        // 在 OffscreenCanvas 上做背景虚化
        const blurred = blurBackground(vframe);
        encoder.encode(blurred, { keyFrame: vframe.type === 'key' });
        blurred.close();
        vframe.close();
      },
      error: (e) => console.error(e),
    });
    decoder.configure({ codec: 'avc1.42E01E', codedWidth: 1280, codedHeight: 720 });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        // 重封装为 RTCEncodedVideoFrame 写回 writable
        const frame = new RTCEncodedVideoFrame({
          type: chunk.type,
          timestamp: chunk.timestamp,
          data: chunk.byteLength ? chunk.copyTo(new Uint8Array(chunk.byteLength)) : new Uint8Array(0),
        });
        writer.write(frame);
      },
      error: (e) => console.error(e),
    });
    encoder.configure({ codec: 'vp8', width: 1280, height: 720, bitrate: 1_000_000 });

    let writer;
    readable.pipeThrough(new TransformStream({
      start: async (controller) => {
        const ws = new WritableStream({
          write: (f) => decoder.decode(encodedFrameToChunk(f)),
        });
        writer = ws.getWriter();
      },
      transform: (frame, controller) => {
        // 解码 → output 回调 → 编码 → output 回调 → 写回
        decoder.decode(encodedFrameToChunk(frame));
      }
    })).pipeTo(writable);
  };

【VideoFrame 关键属性（WebCodecs）】
  interface VideoFrame {
    readonly format: string;          // 'I420' / 'NV12' / 'RGBA' 等
    readonly codedWidth: number;      // 编码宽度（含 padding）
    readonly codedHeight: number;
    readonly codedRect: DOMRectReadOnly;
    readonly visibleRect: DOMRectReadOnly;
    readonly displayWidth: number;    // 显示宽度
    readonly displayHeight: number;
    readonly timestamp: number;       // 微秒
    readonly duration: number;        // 微秒
    readonly colorSpace: VideoColorSpace;
    copyTo(): ArrayBuffer;            // 拷贝像素数据
    clone(): VideoFrame;
    close(): void;                    // 必须调用释放内存
  }

  // RTCEncodedVideoFrame.timestamp 与 VideoFrame.timestamp 单位一致（微秒）
  // 可直接透传，避免音视频不同步

【OffscreenCanvas 背景虚化（worker 内）】
  // worker 内可用 OffscreenCanvas（不依赖主线程 DOM）
  const canvas = new OffscreenCanvas(1280, 720);
  const ctx = canvas.getContext('2d');

  function blurBackground(vframe) {
    ctx.drawImage(vframe, 0, 0, 1280, 720);
    // 简单虚化：先缩小再放大（box blur 近似）
    const tmp = new OffscreenCanvas(64, 36);
    const tmpCtx = tmp.getContext('2d');
    tmpCtx.drawImage(canvas, 0, 0, 64, 36);
    ctx.filter = 'blur(8px)';
    ctx.drawImage(tmp, 0, 0, 1280, 720);
    ctx.filter = 'none';
    // 重新封装为 VideoFrame
    return new VideoFrame(canvas, { timestamp: vframe.timestamp });
  }

  // 进阶：用 tensorflow.js / MediaPipe 做人体分割（精确虚化背景）

【性能考量】
  - VideoDecoder / VideoEncoder 跑在浏览器内部线程，不阻塞 worker 主线程
  - 但解码 → 处理 → 编码的串联会增加 1-2 帧延迟
  - 实时会议建议：跳过关键帧处理（只处理 delta），或降分辨率处理
  - VideoFrame.close() 必须调用，否则显存泄漏

【浏览器支持】
  VideoFrame:    ${f.videoFrame ? '✓' : '✗'} (Chrome 94+ / Safari 16.4+ / Edge 94+)
  VideoDecoder:  ${f.videoDecoder ? '✓' : '✗'} (Chrome 94+ / Safari 16.4+)
  VideoEncoder:  ${f.videoEncoder ? '✓' : '✗'} (Chrome 94+ / Safari 16.4+)
  RTCRtpScriptTransform: ${f.rtcRtpScriptTransform ? '✓' : '✗'}

【常见陷阱】
  1. VideoFrame 必须 close()，否则显存泄漏（每帧都泄漏很快 OOM）
  2. RTCEncodedVideoFrame → EncodedVideoChunk 时 type 必须映射（key/delta）
  3. VideoDecoder.configure 的 codec 字符串必须精确（如 'avc1.42E01E' 不是 'h264'）
  4. 转码串联会增加延迟，实时会议需权衡画质 vs 延迟
  5. OffscreenCanvas 在 worker 内可用，但旧 Safari 不支持
  6. VideoEncoder 输出的 meta 需透传给解码端（描述帧结构）
`;
    this.setState({ webcodecsInfo: info });
    this._addLog('info', 'WebCodecs 互转演示完成（解码 → 处理 → 重编码 管线）');
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const code = `// worker 内：RTCEncodedVideoFrame → VideoFrame → 处理 → 重编码
// 1. RTCEncodedVideoFrame → EncodedVideoChunk
function toChunk(frame) {
  return new EncodedVideoChunk({
    type: frame.type === 'key' ? 'key' : 'delta',
    timestamp: frame.timestamp,
    data: frame.data,
  });
}

// 2. VideoDecoder 解码为 VideoFrame
const decoder = new VideoDecoder({
  output: (vframe) => {
    // vframe: VideoFrame（未编码，可 Canvas 处理）
    const blurred = blurOnCanvas(vframe);
    encoder.encode(blurred, { keyFrame: vframe.type === 'key' });
    blurred.close();
    vframe.close();  // 必须 close 释放显存
  },
  error: (e) => console.error(e),
});
decoder.configure({ codec: 'avc1.42E01E', codedWidth: 1280, codedHeight: 720 });

// 3. VideoEncoder 重编码为 VP8
const encoder = new VideoEncoder({
  output: (chunk, meta) => {
    // chunk: EncodedVideoChunk → 重封装写回 writable
    writer.write(wrapAsEncodedFrame(chunk));
  },
  error: (e) => console.error(e),
});
encoder.configure({ codec: 'vp8', width: 1280, height: 720, bitrate: 1_000_000 });`;
    const card = new Card({
      title: '6. 与 WebCodecs 互转 —— RTCEncodedVideoFrame ↔ VideoFrame',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['VideoFrame', f.videoFrame],
          ['VideoDecoder', f.videoDecoder],
          ['VideoEncoder', f.videoEncoder],
        ]),
        h(Tag, { color: 'primary' }, 'WebCodecs'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'RTCEncodedVideoFrame（已编码，H.264 NALU / VP8）↔ VideoFrame（WebCodecs 未编码，YUV/RGB）互转：RTCEncodedVideoFrame → EncodedVideoChunk（type/timestamp/data 直接复用）→ VideoDecoder.decode() → VideoFrame → Canvas/AI 处理 → VideoEncoder.encode() → EncodedVideoChunk → 重封装写回 writable。典型场景：H.264 → VP8 转码、实时背景虚化（解码 → OffscreenCanvas blur → 重编码）、视频分析（解码后送 AI 模型）。VideoFrame.close() 必须调用释放显存。串联会增加 1-2 帧延迟。',
        ),
        h('div', { class: 'rtc-et-pipeline' },
          h('span', { class: 'rtc-et-pipe-node' }, 'EncodedFrame'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node rtc-et-pipe-node--worker' }, 'VideoDecoder'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node' }, 'VideoFrame'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node rtc-et-pipe-node--worker' }, 'Canvas/AI'),
          h('span', { class: 'rtc-et-pipe-arrow' }, '→'),
          h('span', { class: 'rtc-et-pipe-node rtc-et-pipe-node--worker' }, 'VideoEncoder'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 WebCodecs 互转演示', { type: 'primary', size: 'sm', onClick: () => this._runWebCodecsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.webcodecsInfo || '（点击按钮查看 WebCodecs 互转完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：实战场景 =====================

  _runScenarioDemo() {
    const f = this._flags();
    this._addLog('info', `实战场景演示：videoFrame=${f.videoFrame} trackProcessor=${f.trackProcessor} audioData=${f.audioData}`);
    if (!f.videoFrame) this._addLog('warn', 'VideoFrame 不可用，背景虚化 / 水印演示仅展示代码');
    if (!f.trackProcessor) this._addLog('warn', 'MediaStreamTrackProcessor 不可用，本地摄像头处理管线降级');
    if (!f.audioData) this._addLog('warn', 'AudioData 不可用，音频降噪 WASM 管线仅展示代码');
    const info = `
===== 实战场景：背景虚化 / 水印注入 / 音频降噪 =====

【场景 1：实时背景虚化（VideoFrame → Canvas → VideoFrame）】
  // 用 MediaStreamTrackProcessor 拆分本地摄像头流为 VideoFrame 流
  // 在 worker 内 Canvas 虚化 → 重新合成 MediaStreamTrack 输出
  // 注意：这条管线不走 WebRTC Insertable Streams，而是 TrackProcessor + Generator

  // 主线程
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  const track = stream.getVideoTracks()[0];

  const processor = new MediaStreamTrackProcessor({ track });
  const generator = new MediaStreamTrackGenerator({ kind: 'video' });

  // 在 worker 内处理（避免主线程卡顿）
  const worker = new Worker('blur-worker.js');
  worker.postMessage({ readable: processor.readable, writable: generator.writable }, [processor.readable, generator.writable]);

  // 输出 track 接入 RTCPeerConnection
  pc.addTrack(generator, stream);

  // blur-worker.js
  self.onmessage = (e) => {
    const { readable, writable } = e.data;
    const canvas = new OffscreenCanvas(640, 360);
    const ctx = canvas.getContext('2d');
    readable.pipeThrough(new TransformStream({
      transform: (frame, controller) => {
        // frame: VideoFrame（未编码）
        ctx.drawImage(frame, 0, 0, 640, 360);
        // 背景虚化：缩小再放大（box blur 近似）
        const tmp = new OffscreenCanvas(32, 18);
        tmp.getContext('2d').drawImage(canvas, 0, 0, 32, 18);
        ctx.filter = 'blur(10px)';
        ctx.drawImage(tmp, 0, 0, 640, 360);
        ctx.filter = 'none';
        const out = new VideoFrame(canvas, { timestamp: frame.timestamp });
        controller.enqueue(out);
        frame.close();
      }
    })).pipeTo(writable);
  };

  // 进阶：用 MediaPipe Selfie Segmentation 做人体分割（精确虚化，保留人物清晰）
  // mediapipe.selfieSegmentation.detect(videoFrame) → mask → 合成

【场景 2：水印注入（Insertable Streams + NALU SEI）】
  // 在 RTCEncodedVideoFrame 中注入 H.264 SEI NALU（版权水印）
  // worker 内
  self.onrtcrtpscripttransform = (event) => {
    const { transformer } = event;
    if (transformer.name !== 'watermark') return;
    transformer.readable.pipeThrough(new TransformStream({
      transform: (frame, controller) => {
        if (frame.type === 'key') {
          // 仅在关键帧注入 SEI（避免每帧开销）
          frame.data = injectSEI(frame.data, '© 2026 MyCorp');
        }
        controller.enqueue(frame);
      }
    })).pipeTo(transformer.writable);
  };

  // H.264 SEI NALU 构造
  function injectSEI(frameData, text) {
    const input = new Uint8Array(frameData);
    // SEI NALU: 0x00 0x00 0x00 0x01 0x06 (NAL type 6 = SEI)
    const payload = new TextEncoder().encode(text);
    const sei = new Uint8Array(5 + 1 + 1 + payload.length + 1 + 1);  // startcode + type + size + payload + rbsp_stop + alignment
    sei.set([0, 0, 0, 1, 0x06, 0x05, payload.length], 0);  // type 5 = user_data_unregistered
    sei.set(payload, 7);
    sei[sei.length - 1] = 0x80;  // rbsp stop bit
    const output = new Uint8Array(input.length + sei.length);
    output.set(sei, 0);
    output.set(input, sei.length);
    return output.buffer;
  }

【场景 3：音频降噪（AudioData 走 WASM RNNoise）】
  // 用 MediaStreamTrackProcessor 拆分音频流为 AudioData 流
  // 在 worker 内调用 WASM RNNoise 降噪 → MediaStreamTrackGenerator 输出

  // 主线程
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const track = stream.getAudioTracks()[0];
  const processor = new MediaStreamTrackProcessor({ track });
  const generator = new MediaStreamTrackGenerator({ kind: 'audio' });

  const worker = new Worker('denoise-worker.js');
  worker.postMessage({
    readable: processor.readable,
    writable: generator.writable,
  }, [processor.readable, generator.writable]);

  // denoise-worker.js
  let rnnoise;  // WASM 模块
  self.onmessage = async (e) => {
    const { readable, writable } = e.data;
    const wasm = await WebAssembly.instantiateStreaming(fetch('/rnnoise.wasm'));
    rnnoise = wasm.instance.exports;

    readable.pipeThrough(new TransformStream({
      transform: (audioData, controller) => {
        // audioData: AudioData（WebCodecs）
        // 1. 提取 PCM 样本
        const samples = new Float32Array(audioData.numberOfFrames);
        audioData.copyTo(samples, { planeIndex: 0, format: 'f32-planar' });

        // 2. RNNoise 降噪（WASM）
        const denoised = rnnoise.process(samples);

        // 3. 重新封装为 AudioData
        const out = new AudioData({
          format: 'f32-planar',
          sampleRate: audioData.sampleRate,
          numberOfFrames: denoised.length,
          numberOfChannels: 1,
          timestamp: audioData.timestamp,
          data: denoised,
        });
        controller.enqueue(out);
        audioData.close();
      }
    })).pipeTo(writable);
  };

【场景 4：自定义转码（H.264 → VP8，跨编解码器兼容）】
  // 见 Card 6 完整代码：VideoDecoder + Canvas + VideoEncoder

【场景 5：录制加密流（SFrame + MediaRecorder）】
  // 录制端到端加密会议，需先解密再录制（或录制密文 + 密钥分开存储）
  // 接收端 transform 解密后，用 MediaRecorder 录制明文流
  // 安全考虑：密钥用 KMS 管理，与密文分开存储

【场景 6：多路转码（一路输入 → 多路不同分辨率输出）】
  // 输入 1080p H.264 → 解码 → 分别编码 720p / 480p → 多路 sender
  // 适合 SFU 转发不同分辨率给不同带宽客户端

【性能与延迟权衡】
  场景          典型延迟     CPU 开销    GPU 加速
  背景虚化       10-20ms     中          ✓（OffscreenCanvas）
  水印注入       <1ms        极低        ✗（纯字节操作）
  音频降噪       5-10ms      中          ✗（WASM）
  转码 H264→VP8  20-40ms     高          ✓（VideoEncoder/Decoder）
  SFrame 加密    1-3ms       低          ✗（AES-GCM）

【浏览器支持】
  VideoFrame:               ${f.videoFrame ? '✓' : '✗'} (背景虚化 / 转码)
  MediaStreamTrackProcessor: ${f.trackProcessor ? '✓' : '✗'} (本地流处理)
  MediaStreamTrackGenerator: ${f.trackGenerator ? '✓' : '✗'} (重合成流)
  AudioData:                ${f.audioData ? '✓' : '✗'} (音频降噪)
  RTCRtpScriptTransform:    ${f.rtcRtpScriptTransform ? '✓' : '✗'} (水印 / 加密)

【常见陷阱】
  1. 背景虚化用 OffscreenCanvas，旧 Safari 不支持（需降级到 main thread Canvas）
  2. 水印 SEI 注入位置错误会破坏 NALU 边界，导致解码失败
  3. WASM RNNoise 需 480ms 帧长（20ms 会欠采样），需 buffer 攒帧
  4. AudioData.copyTo 的 format 必须匹配（f32-planar / s16-planar）
  5. 多路转码的 VideoEncoder 实例不可复用，每路独立
  6. MediaStreamTrackProcessor / Generator 在 Safari 17+ 才支持
`;
    this.setState({ scenarioInfo: info });
    this._addLog('info', '实战场景演示完成（背景虚化 / 水印注入 / 音频降噪）');
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const code = `// 场景 1：实时背景虚化（TrackProcessor + Generator + OffscreenCanvas）
// 主线程：拆分摄像头流为 VideoFrame 流 → worker 处理 → 重合成
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
const track = stream.getVideoTracks()[0];
const processor = new MediaStreamTrackProcessor({ track });
const generator = new MediaStreamTrackGenerator({ kind: 'video' });
const worker = new Worker('blur-worker.js');
worker.postMessage(
  { readable: processor.readable, writable: generator.writable },
  [processor.readable, generator.writable]
);
pc.addTrack(generator, stream);  // 虚化后的 track 接入 WebRTC

// blur-worker.js：OffscreenCanvas 虚化每帧
self.onmessage = (e) => {
  const { readable, writable } = e.data;
  const canvas = new OffscreenCanvas(640, 360);
  const ctx = canvas.getContext('2d');
  readable.pipeThrough(new TransformStream({
    transform: (frame, controller) => {
      ctx.drawImage(frame, 0, 0, 640, 360);
      const tmp = new OffscreenCanvas(32, 18);
      tmp.getContext('2d').drawImage(canvas, 0, 0, 32, 18);
      ctx.filter = 'blur(10px)';
      ctx.drawImage(tmp, 0, 0, 640, 360);
      ctx.filter = 'none';
      controller.enqueue(new VideoFrame(canvas, { timestamp: frame.timestamp }));
      frame.close();  // 必须 close 释放显存
    }
  })).pipeTo(writable);
};`;
    const card = new Card({
      title: '7. 实战场景 —— 背景虚化 / 水印注入 / 音频降噪',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['VideoFrame', f.videoFrame],
          ['TrackProcessor', f.trackProcessor],
          ['AudioData', f.audioData],
        ]),
        h(Tag, { color: 'primary' }, '实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '三大实战场景：1）实时背景虚化用 MediaStreamTrackProcessor 拆分摄像头流为 VideoFrame 流，worker 内 OffscreenCanvas 缩小再放大近似 box blur，进阶用 MediaPipe Selfie Segmentation 精确人体分割；2）水印注入在 RTCEncodedVideoFrame 关键帧注入 H.264 SEI NALU（NAL type 6 user_data_unregistered），纯字节操作 <1ms；3）音频降噪用 MediaStreamTrackProcessor 拆分音频为 AudioData 流，worker 内调用 WASM RNNoise（需 480ms 帧长）降噪后 MediaStreamTrackGenerator 重合成。性能：背景虚化 10-20ms、水印 <1ms、降噪 5-10ms、转码 20-40ms、SFrame 1-3ms。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战场景演示', { type: 'primary', size: 'sm', onClick: () => this._runScenarioDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.scenarioInfo || '（点击按钮查看实战场景完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：能力检测与降级 =====================

  _runDetectionDemo() {
    const f = this._flags();
    const newAPI = f.rtcRtpScriptTransform && f.senderTransform;
    const legacyAPI = f.createEncodedStreams;
    if (!newAPI && !legacyAPI) {
      this._addLog('warn', '新 API 与旧 API 均不可用，需服务端转码降级（jsdom 无 WebRTC）');
    } else if (newAPI) {
      this._addLog('info', '使用新 API：RTCRtpScriptTransform（推荐，Chrome 105+）');
    } else {
      this._addLog('warn', '新 API 不可用，降级到 createEncodedStreams()（旧 API，Chrome 86-105）');
    }
    const info = `
===== 能力检测与降级 =====

【能力检测：新 API 优先 + 旧 API 降级】
  // 1. 检测新 API：RTCRtpScriptTransform + sender.transform
  function hasNewAPI() {
    return typeof RTCRtpScriptTransform !== 'undefined'
        && typeof RTCRtpSender !== 'undefined'
        && 'transform' in RTCRtpSender.prototype;
  }

  // 2. 检测旧 API：createEncodedStreams
  function hasLegacyAPI() {
    return typeof RTCRtpSender !== 'undefined'
        && typeof RTCRtpSender.prototype.createEncodedStreams === 'function';
  }

  // 3. 统一封装：优先新 API，降级旧 API
  function attachTransform(sender, worker, name, options) {
    if (hasNewAPI()) {
      // 新 API：Worker 隔离，不阻塞主线程（推荐）
      sender.transform = new RTCRtpScriptTransform(worker, name, options);
      return 'new';
    }
    if (hasLegacyAPI()) {
      // 旧 API：主线程处理，性能差（降级方案）
      const { readable, writable } = sender.createEncodedStreams();
      readable.pipeThrough(new TransformStream({
        transform: (frame, controller) => {
          processFrame(frame, name, options);
          controller.enqueue(frame);
        }
      })).pipeTo(writable);
      return 'legacy';
    }
    throw new Error('WebRTC Insertable Streams 不支持，需服务端转码');
  }

【'transform' in RTCRtpSender.prototype 检测原理】
  // RTCRtpSender.prototype.transform 是新 API 的标志位
  //   - Chrome 105+：存在（getter/setter）
  //   - Chrome 86-104：不存在（只有 createEncodedStreams）
  //   - Safari / Firefox：不存在
  // 用 'in' 操作符检测（不能用 typeof，因为它是 getter）

  console.log('transform' in RTCRtpSender.prototype);  // true / false
  console.log('createEncodedStreams' in RTCRtpSender.prototype);  // 旧 API

【降级到 createEncodedStreams()（旧 API）】
  // Chrome 86-105 的过渡 API，已废弃但仍可用
  // 主线程处理（无 Worker 隔离，性能差）
  function legacyEncrypt(sender, key) {
    const { readable, writable } = sender.createEncodedStreams();
    let nonceCounter = 0;
    readable.pipeThrough(new TransformStream({
      transform: async (frame, controller) => {
        const nonce = new Uint8Array(12);
        new DataView(nonce.buffer).setBigUint64(4, BigInt(nonceCounter++), false);
        const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
        const cipher = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: nonce }, cryptoKey, frame.data);
        frame.data = cipher;
        controller.enqueue(frame);
      }
    })).pipeTo(writable);
  }

  // 旧 API 的 createEncodedAudioStreams()（音频专用，已废弃）
  const { readable: audioReadable, writable: audioWritable } = sender.createEncodedAudioStreams();

【与 MediaStreamTrackProcessor 协同】
  // Insertable Streams 处理「已编码帧」（WebRTC 管线）
  // MediaStreamTrackProcessor 处理「未编码帧」（本地流拆分）
  // 两者互补，可串联：

  // 场景：本地摄像头 → 背景虚化（TrackProcessor）→ 编码 → 加密（Insertable Streams）
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  const track = stream.getVideoTracks()[0];

  // 1. TrackProcessor 拆分为 VideoFrame 流
  const processor = new MediaStreamTrackProcessor({ track });
  const generator = new MediaStreamTrackGenerator({ kind: 'video' });

  // 2. worker 虚化处理（VideoFrame → VideoFrame）
  const blurWorker = new Worker('blur-worker.js');
  blurWorker.postMessage(
    { readable: processor.readable, writable: generator.writable },
    [processor.readable, generator.writable]
  );

  // 3. 虚化后的 track 加入 RTCPeerConnection
  const sender = pc.addTrack(generator, stream);

  // 4. Insertable Streams 在编码后帧加密
  const encWorker = new Worker('encrypt-worker.js');
  sender.transform = new RTCRtpScriptTransform(encWorker, 'encrypt', { key });

【完整能力检测矩阵】
  function detectAll() {
    return {
      // 新 API（推荐）
      rtcRtpScriptTransform: typeof RTCRtpScriptTransform !== 'undefined',
      senderTransform: typeof RTCRtpSender !== 'undefined' && 'transform' in RTCRtpSender.prototype,
      receiverTransform: typeof RTCRtpReceiver !== 'undefined' && 'transform' in RTCRtpReceiver.prototype,
      // 旧 API（降级）
      createEncodedStreams: typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.prototype.createEncodedStreams === 'function',
      createEncodedAudioStreams: typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.prototype.createEncodedAudioStreams === 'function',
      // 配套 API
      trackProcessor: typeof MediaStreamTrackProcessor !== 'undefined',
      trackGenerator: typeof MediaStreamTrackGenerator !== 'undefined',
      videoFrame: typeof VideoFrame !== 'undefined',
      audioData: typeof AudioData !== 'undefined',
      // 加密依赖
      webCrypto: typeof crypto !== 'undefined' && !!crypto.subtle,
      worker: typeof Worker !== 'undefined',
    };
  }

【浏览器支持矩阵（2024-2026）】
  浏览器        新 API        旧 API        TrackProcessor  WebCodecs  WebCrypto
  Chrome 105+   ✓ RTCRtpScriptTransform  ✓（降级）  ✓ 105+         ✓ 94+      ✓
  Edge 105+     ✓              ✓（降级）   ✓              ✓          ✓
  Chrome 86-104 ✗              ✓            ✗              ✓ 94+      ✓
  Safari 17+    ✗ 暂不支持     ✗            ✓ 17+          ✓ 16.4+    ✓
  Firefox       ✗ 暂不支持     ✗            ✗              ✗          ✓

【降级决策树】
  if (hasNewAPI()) {
    // Chrome 105+ / Edge 105+：用 RTCRtpScriptTransform（推荐）
  } else if (hasLegacyAPI()) {
    // Chrome 86-104：用 createEncodedStreams（降级，主线程处理）
  } else if (hasWebCodecs() && hasTrackProcessor()) {
    // Safari 17+：用 MediaStreamTrackProcessor + WebCodecs 自建管线
    // 不走 WebRTC 管线，需手动编码后通过 DataChannel 传输（复杂）
  } else {
    // Safari <17 / Firefox：服务端转码
    // 媒体流发到服务端，服务端用 FFmpeg 处理后返回
  }

【实际能力检测演示】
  RTCRtpScriptTransform:        ${f.rtcRtpScriptTransform ? '✓' : '✗'} (Chrome 105+)
  sender.transform:             ${f.senderTransform ? '✓' : '✗'} (新 API 标志位)
  createEncodedStreams:         ${f.createEncodedStreams ? '✓' : '✗'} (旧 API，降级用)
  MediaStreamTrackProcessor:    ${f.trackProcessor ? '✓' : '✗'} (Safari 17+)
  VideoFrame (WebCodecs):       ${f.videoFrame ? '✓' : '✗'} (Chrome 94+ / Safari 16.4+)
  WebCrypto:                    ${f.webCrypto ? '✓' : '✗'} (加密依赖)

【常见陷阱】
  1. createEncodedStreams 已废弃，新代码必须用 RTCRtpScriptTransform
  2. Safari / Firefox 暂不支持 Insertable Streams，需服务端转码降级
  3. 'transform' in prototype 检测需 RTCRtpSender 已定义（typeof 先判）
  4. 旧 API 主线程处理会阻塞 UI，加密重负载需谨慎
  5. TrackProcessor / Generator 在 Safari 17+ 才支持，旧 Safari 无法自建管线
  6. 服务端转码降级会增加 1-2 秒延迟，仅作为最后兜底
`;
    this.setState({ detectionInfo: info });
    this._addLog('info', '能力检测与降级演示完成（新 API 优先 + 旧 API 降级 + 服务端兜底）');
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const code = `// 能力检测：新 API 优先，旧 API 降级，服务端兜底
function hasNewAPI() {
  return typeof RTCRtpScriptTransform !== 'undefined'
      && typeof RTCRtpSender !== 'undefined'
      && 'transform' in RTCRtpSender.prototype;
}
function hasLegacyAPI() {
  return typeof RTCRtpSender !== 'undefined'
      && typeof RTCRtpSender.prototype.createEncodedStreams === 'function';
}

// 统一封装
function attachTransform(sender, worker, name, options) {
  if (hasNewAPI()) {
    // 新 API：Worker 隔离（推荐）
    sender.transform = new RTCRtpScriptTransform(worker, name, options);
    return 'new';
  }
  if (hasLegacyAPI()) {
    // 旧 API：主线程处理（降级）
    const { readable, writable } = sender.createEncodedStreams();
    readable.pipeThrough(new TransformStream({
      transform: (frame, controller) => {
        processFrame(frame, name, options);
        controller.enqueue(frame);
      }
    })).pipeTo(writable);
    return 'legacy';
  }
  throw new Error('Insertable Streams 不支持，需服务端转码');
}

// 完整能力矩阵
const caps = {
  newAPI: hasNewAPI(),
  legacyAPI: hasLegacyAPI(),
  trackProcessor: typeof MediaStreamTrackProcessor !== 'undefined',
  videoFrame: typeof VideoFrame !== 'undefined',
  webCrypto: typeof crypto !== 'undefined' && !!crypto.subtle,
};`;
    const card = new Card({
      title: '8. 能力检测与降级 —— 新 API 优先 + 旧 API + 服务端兜底',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['新 API', f.rtcRtpScriptTransform && f.senderTransform],
          ['旧 API', f.createEncodedStreams],
          ['TrackProcessor', f.trackProcessor],
        ]),
        h(Tag, { color: 'primary' }, '检测'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '能力检测优先级：新 API（RTCRtpScriptTransform + \'transform\' in RTCRtpSender.prototype，Chrome 105+）→ 旧 API（createEncodedStreams，Chrome 86-105 主线程处理）→ MediaStreamTrackProcessor + WebCodecs 自建管线（Safari 17+）→ 服务端转码兜底（Safari<17 / Firefox）。\'transform\' in prototype 是新 API 标志位（getter/setter，不能用 typeof 检测）。与 MediaStreamTrackProcessor 协同：本地流 TrackProcessor 拆 VideoFrame 处理 → 编码 → Insertable Streams 加密。createEncodedAudioStreams 是音频专用旧 API。',
        ),
        h('div', { class: 'rtc-et-matrix' },
          h('div', { class: 'rtc-et-matrix-cell' }, h('b', {}, 'Chrome 105+'), h('br'), '✓ 新 API', h('br'), '✓ 旧 API（降级）'),
          h('div', { class: 'rtc-et-matrix-cell' }, h('b', {}, 'Chrome 86-104'), h('br'), '✗ 新 API', h('br'), '✓ 旧 API'),
          h('div', { class: 'rtc-et-matrix-cell' }, h('b', {}, 'Safari 17+'), h('br'), '✗ 新 API', h('br'), '✗ 旧 API'),
          h('div', { class: 'rtc-et-matrix-cell' }, h('b', {}, 'Firefox'), h('br'), '✗ 新 API', h('br'), '✗ 旧 API'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行能力检测演示', { type: 'primary', size: 'sm', onClick: () => this._runDetectionDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '440px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.detectionInfo || '（点击按钮查看能力检测与降级完整说明）')),
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
      h('h2', { class: 'section-title' }, 'RTCEncodedTransform / WebRTC Insertable Streams 深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'RTCEncodedTransform / WebRTC Insertable Streams —— 端到端加密视频会议、AI 背景替换',
        description: '演示 WebRTC Insertable Streams（可插入流）完整体系：概念与演进（createEncodedStreams 旧 API → RTCEncodedTransform 过渡 → RTCRtpScriptTransform 新 API Chrome 105+ 规范方向，Worker 隔离不阻塞主线程，与 WebCodecs 互补）、transform 绑定（RTCRtpSender/Receiver.transform + new RTCRtpScriptTransform(worker, name, options) 构造器，options 结构化克隆透传，不能传函数/DOM）、Worker 端事件（self.onrtcrtpscripttransform + event.transformer.readable/writable 端到端管道 + pipeThrough TransformStream）、EncodedFrame 接口（RTCEncodedVideoFrame/AudioFrame：type/timestamp/data ArrayBuffer + getMetadata()/getContributingSources()，仅 worker 内可见）、SFrame 端到端加密实战（ECDH 协商 + AES-GCM 256 加密每帧 + nonce 单调递增管理 + HKDF 密钥轮换 + 与 Web Crypto 协同）、与 WebCodecs 互转（RTCEncodedVideoFrame → EncodedVideoChunk → VideoDecoder → VideoFrame → Canvas/AI → VideoEncoder → 重封装，实时背景虚化与跨编解码器转码）、实战场景（背景虚化 OffscreenCanvas、H.264 SEI NALU 水印注入、WASM RNNoise 音频降噪）、能力检测与降级（\'transform\' in prototype 新 API 检测 + createEncodedStreams 旧 API 降级 + MediaStreamTrackProcessor 协同 + 服务端转码兜底 + 浏览器支持矩阵）。jsdom 无真实 WebRTC 栈所有检测为 false，真实浏览器 Chrome 105+ / Edge 105+ 可完整体验。',
      }),

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
