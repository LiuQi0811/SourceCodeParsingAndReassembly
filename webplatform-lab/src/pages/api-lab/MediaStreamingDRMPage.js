// =====================================================================
// MediaStreamingDRMPage.js —— MSE + EME 流媒体与 DRM 完整实验室
// 演示 W3C Media Source Extensions（MSE）与 Encrypted Media Extensions（EME）
//   8 卡大纲：
//   1. 概述与动机 —— HTMLMediaElement src 局限 / 自适应码率流媒体（HLS/DASH）
//      需求 / Media Source Extensions (MSE) 标准 / Encrypted Media Extensions
//      (EME) 标准 / 浏览器支持 Chrome/Firefox/Safari/Edge 全部稳定多年
//   2. MediaSource 生命周期 —— new MediaSource() / URL.createObjectURL /
//      onsourceopen / addSourceBuffer() / appendBuffer() / remove() /
//      endOfStream() / duration 设置
//   3. SourceBuffer 与 ArrayBuffer —— addSourceBuffer(codec) / codec 字符串
//      (video/mp4; codecs="avc1.42E01E") / appendBuffer() / mode: 'segments'/
//      'sequence' / timestampOffset / appendWindowStart/End
//   4. 自适应码率切换 —— webkitDroppedFrameCount / adaptive bitrate / DASH
//      manifest / HLS m3u8 / sourceBuffer.changeType() / 平滑切换不卡顿
//   5. EME 基础与 Encrypted Media —— mediaKeys / requestMediaKeySystemAccess /
//      keySystems (com.widevine.alpha/com.microsoft.playready/com.apple.fps) /
//      MediaKeys / MediaKeySession
//   6. Widevine/PlayReady/FairPlay —— DRM 系统对比 / Widevine L1/L3 /
//      PlayReady SL2000/SL3000 / FairPlay Streaming (FPS) / license server /
//      persistent-license 临时 vs 持久
//   7. license 交换流程 —— generateRequest(initDataType, initData) /
//      message 事件 → license server → update(response) /
//      keystatuseschange 事件 / ClearKey 调试 / encrypted 事件
//   8. 实战与陷阱 —— HLS.js + MSE / Shaka Player DASH / 防盗链与 token /
//      跨域 CORS / MediaSource 跨浏览器 codec 兼容性 / 拖拽 seek /
//      加密内容与 Clear Key 调试
// 说明：所有特性调用前做 typeof / in 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实媒体解码与
//       DRM 握手，MediaSource/EME 在 jsdom 通常不可用，统一兜底。
//       注入演示样式 + 完整代码示例，真实浏览器可查看完整流程。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class MediaStreamingDRMPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',     // Card 1：概述与动机
      lifecycleInfo: '',    // Card 2：MediaSource 生命周期
      sourceBufferInfo: '', // Card 3：SourceBuffer 与 ArrayBuffer
      adaptiveInfo: '',    // Card 4：自适应码率切换
      emeBasicsInfo: '',    // Card 5：EME 基础与 Encrypted Media
      drmSystemsInfo: '',   // Card 6：Widevine/PlayReady/FairPlay
      licenseInfo: '',      // Card 7：license 交换流程
      pitfallsInfo: '',     // Card 8：实战与陷阱
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];   // 动态创建并插入 head 的 <style> 元素列表
    this._mediaSource = null;   // 若真实环境创建过 MediaSource，销毁时关闭
    this._mediaKeys = null;      // 若真实环境创建过 MediaKeys，销毁时释放
    this._keySessions = [];      // MediaKeySession 列表（componentWillUnmount 中 close）

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `MediaSource ${c(f.mediaSource)}`,
      `SourceBuffer ${c(f.sourceBuffer)}`,
      `SourceBufferList ${c(f.sourceBufferList)}`,
      `MediaKeys ${c(f.mediaKeys)}`,
      `requestMediaKeySystemAccess ${c(f.requestMediaKeySystemAccess)}`,
      `mediaCapabilities ${c(f.mediaCapabilities)}`,
      `MediaKeySession ${c(f.mediaKeySession)}`,
      `MediaKeySystemAccess ${c(f.mediaKeySystemAccess)}`,
      `URL.createObjectURL ${c(f.createObjectURL)}`,
    ];

    const any = f.mediaSource || f.mediaKeys;
    const summary = any
      ? `MSE + EME 能力检测：${parts.join(' · ')}。当前环境支持部分 MSE/EME API，可真实体验 MediaSource / SourceBuffer 生命周期与 EME 握手；DRM 加密内容需 license server 与真实媒体分片配合。`
      : `MSE + EME 能力检测：${parts.join(' · ')}。jsdom/Node 环境无 MediaSource/EME（浏览器原生媒体 API），所有按钮点击仅记日志说明，绝不抛异常；真实 Chrome/Firefox/Safari/Edge 可完整体验。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.mediaSource) this._addLog('warn', 'MediaSource 不可用（jsdom 无原生媒体栈，Chrome 23+/Firefox 42+/Safari 8+/Edge 全部稳定多年）');
    if (!f.sourceBuffer) this._addLog('warn', 'SourceBuffer 不可用（MediaSource 的核心子对象，jsdom 无）');
    if (!f.mediaKeys) this._addLog('warn', 'MediaKeys 不可用（EME 的密钥管理对象，jsdom 无）');
    if (!f.requestMediaKeySystemAccess) this._addLog('warn', 'navigator.requestMediaKeySystemAccess 不可用（EME 入口，jsdom 无）');
    if (!f.mediaKeySession) this._addLog('warn', 'MediaKeySession 不可用（DRM 会话对象，jsdom 无）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 关闭可能创建过的 MediaSource / MediaKeys / MediaKeySession（jsdom 中恒为 null）
    this._closeMediaSource();
    this._closeMediaKeys();
    // 移除动态创建的 <style> 元素，便于 GC
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

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  _flags() {
    const safe = (fn) => {
      try { return fn(); } catch { return false; }
    };
    return {
      mediaSource: safe(() => typeof window.MediaSource === 'function'),
      sourceBuffer: safe(() => typeof window.SourceBuffer !== 'undefined'),
      sourceBufferList: safe(() => typeof window.SourceBufferList !== 'undefined'),
      mediaKeys: safe(() => 'MediaKeys' in window),
      requestMediaKeySystemAccess: safe(() => typeof navigator.requestMediaKeySystemAccess === 'function'),
      mediaCapabilities: safe(() => typeof navigator.mediaCapabilities !== 'undefined'),
      mediaKeySession: safe(() => typeof window.MediaKeySession !== 'undefined'),
      mediaKeySystemAccess: safe(() => typeof window.MediaKeySystemAccess !== 'undefined'),
      createObjectURL: safe(() => typeof window.URL.createObjectURL === 'function'),
    };
  }

  _closeMediaSource() {
    if (this._mediaSource) {
      try {
        if (this._mediaSource.readyState === 'open') {
          this._mediaSource.endOfStream();
        }
      } catch { /* noop */ }
      this._mediaSource = null;
    }
  }

  _closeMediaKeys() {
    for (const session of this._keySessions) {
      try { session.close?.(); } catch { /* noop */ }
    }
    this._keySessions = [];
    this._mediaKeys = null;
  }

  _injectBaseStyles() {
    this._injectStyle('mse-eme-base', `
      .mse-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .mse-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      .mse-video {
        width: 100%;
        max-width: 480px;
        background: #000;
        border-radius: 6px;
        display: block;
      }
      .mse-matrix {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .mse-matrix-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
      }
      .mse-matrix-title { font-weight: 600; color: #1e293b; margin-bottom: 4px; }
      .mse-flow {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
        font-size: 12px;
      }
      .mse-flow-node {
        padding: 4px 8px;
        border-radius: 6px;
        background: #e0e7ff;
        color: #1e40af;
        font-weight: 600;
      }
      .mse-flow-node--eme { background: #fee2e2; color: #991b1b; }
      .mse-flow-arrow { color: #64748b; }
      .mse-output {
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
    this._injectStyle('mse-overview-demo', `
      .mse-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== MSE + EME 概述与动机 =====',
      '',
      '【传统 HTMLMediaElement src 的局限】',
      '  <video src="movie.mp4"></video>',
      '  问题：',
      '  1. src 必须指向完整媒体文件，无法分片加载（如 DASH/HLS）',
      '  2. 无法在播放中切换码率（adaptive bitrate streaming）',
      '  3. 无法跳过未下载部分、无法动态拼接广告片段',
      '  4. 无法做加密内容（DRM）的解密播放',
      '  5. 大文件必须整体下载，无法边下边播',
      '',
      '【自适应码率流媒体需求】',
      '  - HLS（HTTP Live Streaming）：Apple 提出，m3u8 manifest + ts 分片',
      '  - DASH（Dynamic Adaptive Streaming over HTTP）：MPEG 提出，mpd manifest + mp4/webm 分片',
      '  - 共同点：将媒体切成小段（2-10s），按网络带宽动态选择码率',
      '  - 浏览器需支持「分片 append 到 media element 缓冲区」的能力 → MSE',
      '',
      '【Media Source Extensions (MSE) 标准】',
      '  W3C 规范：https://www.w3.org/TR/media-source/',
      '  核心能力：',
      '  - new MediaSource() 创建可编程媒体源',
      '  - URL.createObjectURL(mediaSource) 拿到 blob URL 赋给 video.src',
      '  - addSourceBuffer(codec) 创建 SourceBuffer（音视频缓冲区）',
      '  - sourceBuffer.appendBuffer(arrayBuffer) 追加媒体分片',
      '  - sourceBuffer.remove(start, end) 移除已播放分片（节省内存）',
      '  - endOfStream() 标记流结束',
      '',
      '【Encrypted Media Extensions (EME) 标准】',
      '  W3C 规范：https://www.w3.org/TR/encrypted-media/',
      '  核心能力：',
      '  - navigator.requestMediaKeySystemAccess(keySystem, configs) 探测 DRM 系统',
      '  - mediaKeySystemAccess.createMediaKeys() 创建 MediaKeys',
      '  - mediaElement.setMediaKeys(mediaKeys) 绑定到媒体元素',
      '  - mediaKeys.createSession(sessionType) 创建 MediaKeySession',
      '  - session.generateRequest(initDataType, initData) 发起 license 请求',
      '  - session.update(response) 注入 license',
      '',
      '【MSE 与 EME 的协同】',
      '  - MSE 负责把加密分片 append 到 SourceBuffer',
      '  - EME 负责解密分片（通过 CDM = Content Decryption Module）',
      '  - mediaElement 触发 encrypted 事件 → EME 拿到 init data → 与 license server 交换 → 拿到 key → 解密播放',
      '',
      '【浏览器支持（全部稳定多年）】',
      '  MSE：',
      '    Chrome 23+ / Firefox 42+ / Safari 8+ / Edge 12+ / Opera 15+',
      '    iOS Safari 8+（早期仅 HLS 原生，后开放 MSE，iPadOS 完整支持）',
      '  EME：',
      '    Chrome 42+ / Firefox 47+ / Safari 7+（FairPlay）/ Edge 12+',
      '    各浏览器内置不同 DRM 系统（见 Card 6）',
      '',
      '【能力检测代码】',
      "  // 一次性检测本页涉及的全部底层 API",
      "  const hasMediaSource = typeof window.MediaSource === 'function';",
      "  const hasSourceBuffer = typeof window.SourceBuffer !== 'undefined';",
      "  const hasMediaKeys = 'MediaKeys' in window;",
      "  const hasRequestMKSA = typeof navigator.requestMediaKeySystemAccess === 'function';",
      "  const hasMediaCapabilities = typeof navigator.mediaCapabilities !== 'undefined';",
      "  const hasCreateObjectURL = typeof window.URL.createObjectURL === 'function';",
      '',
      '【实际能力检测演示】',
      `  MediaSource: ${f.mediaSource ? '✓' : '✗'}`,
      `  SourceBuffer: ${f.sourceBuffer ? '✓' : '✗'}`,
      `  SourceBufferList: ${f.sourceBufferList ? '✓' : '✗'}`,
      `  MediaKeys: ${f.mediaKeys ? '✓' : '✗'}`,
      `  requestMediaKeySystemAccess: ${f.requestMediaKeySystemAccess ? '✓' : '✗'}`,
      `  mediaCapabilities: ${f.mediaCapabilities ? '✓' : '✗'}`,
      `  MediaKeySession: ${f.mediaKeySession ? '✓' : '✗'}`,
      `  MediaKeySystemAccess: ${f.mediaKeySystemAccess ? '✓' : '✗'}`,
      `  URL.createObjectURL: ${f.createObjectURL ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. video.src 必须是 createObjectURL(mediaSource) 的 blob: URL，不能直接赋 MediaSource 对象',
      '  2. addSourceBuffer(codec) 的 codec 字符串必须严格匹配分片编码（如 avc1.42E01E 而非 avc1）',
      '  3. EME 的 requestMediaKeySystemAccess 是异步 Promise，需 await 拿到 access',
      '  4. license server 通常是后端服务，前端只负责 message 事件转发',
      '  5. iOS Safari 的 MSE 支持受限，HLS 仍推荐用原生 <video src="m3u8">',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('mse', `概述演示完成：MediaSource=${f.mediaSource}，MediaKeys=${f.mediaKeys}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— HTMLMediaElement src 局限 / MSE / EME / 浏览器支持',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['MediaSource', f.mediaSource],
          ['MediaKeys', f.mediaKeys],
          ['requestMKSA', f.requestMediaKeySystemAccess],
        ]),
        h(Tag, { color: 'primary' }, '概述'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '传统 HTMLMediaElement src 必须指向完整媒体文件，无法分片加载与码率切换。MSE（W3C）通过 new MediaSource() + URL.createObjectURL + addSourceBuffer + appendBuffer 提供可编程媒体源，支撑 HLS/DASH 自适应码率。EME（W3C）通过 requestMediaKeySystemAccess + createMediaKeys + createSession + generateRequest + update 实现 DRM license 交换与解密播放。MSE 负责把加密分片 append 到 SourceBuffer，EME 负责通过 CDM 解密。浏览器支持：Chrome 23+/Firefox 42+/Safari 8+/Edge 全部稳定多年；iOS Safari MSE 支持受限，HLS 推荐原生 src。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行概述演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 传统 <video src> —— 无法分片/码率切换
<video src="movie.mp4" controls></video>

// MSE：可编程媒体源（支撑 HLS.js / Shaka Player）
const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);
mediaSource.addEventListener('sourceopen', () => {
  const sb = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
  fetchSegment(url).then(buf => sb.appendBuffer(buf));
});

// EME：DRM license 交换
const access = await navigator.requestMediaKeySystemAccess(
  'com.widevine.alpha',
  [{ initDataTypes: ['cenc'], audioCapabilities: [{ contentType: 'audio/mp4' }] }],
);
const keys = await access.createMediaKeys();
await video.setMediaKeys(keys);
const session = keys.createSession();
session.addEventListener('message', e => fetchLicense(e.data).then(r => session.update(r)));
session.generateRequest('cenc', initData);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 MSE + EME 概述与动机完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：MediaSource 生命周期 =====================

  _runLifecycleDemo() {
    const f = this._flags();
    this._injectStyle('mse-lifecycle-demo', `
      .mse-lifecycle-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.mediaSource) {
      this._addLog('warn', 'MediaSource 不可用，生命周期仅展示 API 用法（jsdom 无原生媒体栈）');
    } else if (!f.createObjectURL) {
      this._addLog('warn', 'URL.createObjectURL 不可用，无法创建 blob URL（jsdom 无）');
    } else {
      // 真实环境：创建 MediaSource 但不真实 append 媒体分片（避免阻塞）
      this._addLog('info', '检测到 MediaSource + createObjectURL，可演示真实生命周期');
    }
    const info = [
      '===== MediaSource 生命周期：构造 / sourceopen / addSourceBuffer / appendBuffer / endOfStream =====',
      '',
      '【构造与绑定 video.src】',
      '  const mediaSource = new MediaSource();',
      '  // readyState: "closed" → "open" → "ended"',
      '  video.src = URL.createObjectURL(mediaSource);  // blob: URL',
      '',
      '  // 必须监听 sourceopen 才能操作（readyState = open 后）',
      '  mediaSource.addEventListener("sourceopen", () => {',
      '    // 在此 addSourceBuffer / appendBuffer',
      '  });',
      '',
      '【readyState 状态机】',
      '  closed  → 构造时，未挂载到 video',
      '  open    → sourceopen 触发后，可操作',
      '  ended   → endOfStream() 调用后，流结束',
      '',
      '  状态迁移：closed → open → ended',
      '  不可逆：ended 后不能再 appendBuffer',
      '',
      '【addSourceBuffer(codec)】',
      '  const sb = mediaSource.addSourceBuffer("video/mp4; codecs=\\"avc1.42E01E\\"");',
      '  // 可添加多个 SourceBuffer（如分别音视频）',
      '  const audioSb = mediaSource.addSourceBuffer("audio/mp4; codecs=\\"mp4a.40.2\\"");',
      '',
      '【appendBuffer() 追加分片】',
      '  // 接收 ArrayBuffer / ArrayBufferView（Uint8Array）',
      '  const resp = await fetch(segmentUrl);',
      '  const buf = await resp.arrayBuffer();',
      '  sb.appendBuffer(buf);  // 异步，触发 updateend 事件',
      '',
      '  // 监听更新完成，再 append 下一片（避免并发冲突）',
      '  sb.addEventListener("updateend", () => {',
      '    console.log("append 完成，buffered =", sb.buffered);',
      '    appendNextSegment();',
      '  });',
      '',
      '【remove() 移除已播放分片】',
      '  // 节省内存：移除 [start, end] 范围内的缓冲',
      '  sb.remove(0, 30);  // 移除 0-30 秒的缓冲',
      '  // 同样触发 updateend 事件',
      '',
      '【endOfStream() 标记流结束】',
      '  // 所有分片 append 完成后调用',
      '  mediaSource.endOfStream();  // 默认 "success"',
      '  mediaSource.endOfStream("network");   // 网络错误',
      '  mediaSource.endOfStream("decode");    // 解码错误',
      '',
      '【duration 设置】',
      '  // 设置媒体总时长（影响 seek 范围）',
      '  mediaSource.duration = 120;  // 120 秒',
      '  // 或设为 Infinity（直播流）',
      '  mediaSource.duration = Number.POSITIVE_INFINITY;',
      '  // duration 改变触发 durationchange 事件',
      '',
      '【完整的「加载分片 → 播放 → seek → 追加新分片」流程】',
      '  async function loadSegment(sb, url) {',
      '    const resp = await fetch(url);',
      '    const buf = await resp.arrayBuffer();',
      '    return new Promise((resolve) => {',
      '      sb.addEventListener("updateend", () => resolve(), { once: true });',
      '      sb.appendBuffer(buf);',
      '    });',
      '  }',
      '',
      '  mediaSource.addEventListener("sourceopen", async () => {',
      '    const sb = mediaSource.addSourceBuffer("video/mp4; codecs=\\"avc1.42E01E\\"");',
      '    await loadSegment(sb, "init.mp4");      // 初始化分片',
      '    await loadSegment(sb, "seg-1.m4s");     // 媒体分片',
      '    await loadSegment(sb, "seg-2.m4s");',
      '    mediaSource.endOfStream();',
      '  });',
      '',
      '【SourceBufferList 与 activeSourceBuffers】',
      '  mediaSource.sourceBuffers     // 所有 SourceBuffer 列表',
      '  mediaSource.activeSourceBuffers // 当前活跃的 SourceBuffer',
      '',
      '【浏览器支持】',
      `  MediaSource: ${f.mediaSource ? '✓' : '✗'}`,
      `  SourceBuffer: ${f.sourceBuffer ? '✓' : '✗'}`,
      `  SourceBufferList: ${f.sourceBufferList ? '✓' : '✗'}`,
      `  URL.createObjectURL: ${f.createObjectURL ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 必须等 sourceopen 才能操作，构造后立即 addSourceBuffer 抛 InvalidStateError',
      '  2. appendBuffer 并发会抛 InvalidStateError（SourceBuffer.updating=true 时拒绝）',
      '  3. remove 的范围必须在 buffered 范围内，否则抛 NotSupportedError',
      '  4. duration 设为 Infinity 后必须显式设回有限值才能 endOfStream',
      '  5. blob: URL 在 mediaSource 销毁后失效，需 revokeObjectURL 释放内存',
    ].join('\n');
    this.setState({ lifecycleInfo: info });
    this._addLog('mse', `MediaSource 生命周期演示完成：closed→open→ended + appendBuffer/remove/endOfStream`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. MediaSource 生命周期 —— sourceopen / addSourceBuffer / appendBuffer / endOfStream',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['MediaSource', f.mediaSource],
          ['createObjectURL', f.createObjectURL],
        ]),
        h(Tag, { color: 'primary' }, '生命周期'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new MediaSource() 构造（readyState: closed→open→ended），URL.createObjectURL(mediaSource) 拿 blob: URL 赋给 video.src。监听 sourceopen 后 addSourceBuffer(codec) 创建 SourceBuffer。appendBuffer(ArrayBuffer/ArrayBufferView) 追加分片，触发 updateend；remove(start, end) 移除已播放分片节省内存。endOfStream() 标记流结束。duration 设置总时长（直播流设 Infinity）。appendBuffer 并发会抛 InvalidStateError，需等 updating=false。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行生命周期演示', { type: 'primary', size: 'sm', onClick: () => this._runLifecycleDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

mediaSource.addEventListener('sourceopen', async () => {
  const sb = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
  mediaSource.duration = 120; // 120 秒

  const append = async (url) => {
    const buf = await (await fetch(url)).arrayBuffer();
    return new Promise((res) => {
      sb.addEventListener('updateend', res, { once: true });
      sb.appendBuffer(buf);
    });
  };

  await append('init.mp4');
  await append('seg-1.m4s');
  sb.remove(0, 30);           // 移除已播放分片
  await append('seg-2.m4s');
  mediaSource.endOfStream();   // 流结束
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.lifecycleInfo || '（点击按钮查看 MediaSource 生命周期完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：SourceBuffer 与 ArrayBuffer =====================

  _runSourceBufferDemo() {
    const f = this._flags();
    this._injectStyle('mse-sourcebuffer-demo', `
      .mse-sourcebuffer-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.sourceBuffer) {
      this._addLog('warn', 'SourceBuffer 不可用，仅展示 API 用法（jsdom 无 SourceBuffer 类）');
    }
    const info = [
      '===== SourceBuffer 与 ArrayBuffer：codec / mode / timestampOffset / appendWindow =====',
      '',
      '【addSourceBuffer(codec) 的 codec 字符串】',
      '  // MIME 类型 + codecs 参数（必须严格匹配分片编码）',
      '  sb = mediaSource.addSourceBuffer("video/mp4; codecs=\\"avc1.42E01E\\"");',
      '  sb = mediaSource.addSourceBuffer("audio/mp4; codecs=\\"mp4a.40.2\\"");',
      '  sb = mediaSource.addSourceBuffer("video/webm; codecs=\\"vp9\\"");',
      '  sb = mediaSource.addSourceBuffer("audio/webm; codecs=\\"opus\\"");',
      '',
      '【codec 字符串的常见编码】',
      '  H.264 / AVC：avc1.XXXXXX（如 avc1.42E01E = Baseline 3.0）',
      '    42 = Baseline / 4D = Main / 64 = High',
      '    E0 = profile constraint',
      '    1E = level 30 (3.0)',
      '  H.265 / HEVC：hvc1.XXXXXX 或 hev1.XXXXXX',
      '  VP9：vp9（Google）',
      '  AV1：av01.X.X.XX（AOM）',
      '  AAC：mp4a.40.2（AAC-LC）/ mp4a.40.5（HE-AAC）',
      '  Opus：opus',
      '  AV1 编码：av01.0.05M.08',
      '',
      '  // 探测浏览器支持的 codec',
      '  MediaSource.isTypeSupported(\'video/mp4; codecs="avc1.42E01E"\');',
      '  MediaSource.isTypeSupported(\'video/webm; codecs="vp9"\');',
      '',
      '【appendBuffer() 接收 ArrayBuffer / ArrayBufferView】',
      '  // 1. ArrayBuffer（fetch arrayBuffer）',
      '  const buf = await (await fetch(url)).arrayBuffer();',
      '  sb.appendBuffer(buf);',
      '',
      '  // 2. ArrayBufferView（Uint8Array / DataView）',
      '  const view = new Uint8Array(buf)',
      '  sb.appendBuffer(view);',
      '',
      '  // 3. 部分追加（offset/length）',
      '  sb.appendBuffer(view, 0, 1024);  // 仅追加前 1024 字节',
      '',
      '【mode: "segments" vs "sequence"】',
      '  // segments（默认）：依赖分片自带时间戳（media timestamp）',
      '  sb.mode = "segments";',
      '  // sequence：按 append 顺序自动生成时间戳',
      '  sb.mode = "sequence";',
      '',
      '  使用场景：',
      '    segments：媒体分片自带 PTS/DTS（最常用）',
      '    sequence：无时间戳的纯序列（如拼接图片成视频、音频 PCM 流）',
      '',
      '【timestampOffset：偏移时间戳】',
      '  // 在 append 前设置，影响后续分片的时间戳基准',
      '  sb.timestampOffset = 60;  // 后续 append 的分片 +60 秒',
      '  // 常用于：拼接广告片段（在主视频 30s 处插入 15s 广告）',
      '  sb.timestampOffset = 30;',
      '  sb.appendBuffer(adSegment);  // 广告占用 30-45s',
      '  sb.timestampOffset = 45;',
      '  sb.appendBuffer(mainSegment);  // 主视频从 45s 继续',
      '',
      '【appendWindowStart / appendWindowEnd：append 窗口】',
      '  // 限制 append 的有效时间范围，超出窗口的分片被丢弃',
      '  sb.appendWindowStart = 0;     // 起始时间',
      '  sb.appendWindowEnd = 600;     // 结束时间（10 分钟）',
      '  // 常用于：直播滑窗（只保留最近 N 秒）',
      '',
      '【buffered：查询已缓冲范围】',
      '  // TimeRanges 对象，反映已 append 的有效时间范围',
      '  const ranges = sb.buffered;',
      '  for (let i = 0; i < ranges.length; i++) {',
      '    console.log(`缓冲段 ${i}: ${ranges.start(i)} - ${ranges.end(i)}`);',
      '  }',
      '',
      '【updating 状态：避免并发 append】',
      '  // appendBuffer / remove 是异步，触发 updating=true',
      '  // updating=true 时再 append 会抛 InvalidStateError',
      '  if (!sb.updating) {',
      '    sb.appendBuffer(buf);',
      '  }',
      '  // 或等 updateend 事件',
      '  sb.addEventListener("updateend", () => appendNext());',
      '',
      '【音频与视频双 SourceBuffer 同步】',
      '  const videoSb = mediaSource.addSourceBuffer("video/mp4; codecs=\\"avc1.42E01E\\"");',
      '  const audioSb = mediaSource.addSourceBuffer("audio/mp4; codecs=\\"mp4a.40.2\\"");',
      '  // 分别 append，靠 PTS 对齐（mediaSource 内部处理同步）',
      '  videoSb.appendBuffer(videoSegment);',
      '  audioSb.appendBuffer(audioSegment);',
      '',
      '【changeType()：动态切换 codec（自适应码率切换场景）',
      '  // DASH 自适应：从 480p H.264 切到 720p VP9',
      '  if (videoSb.changeType) {',
      '    videoSb.changeType("video/webm; codecs=\\"vp9\\"");',
      '    videoSb.appendBuffer(vp9Segment);',
      '  }',
      '',
      '【浏览器支持】',
      `  MediaSource: ${f.mediaSource ? '✓' : '✗'}`,
      `  SourceBuffer: ${f.sourceBuffer ? '✓' : '✗'}`,
      '  changeType: Chrome 70+ / Firefox 84+ / Safari 14.1+',
      '',
      '【常见陷阱】',
      '  1. codec 字符串必须严格匹配分片编码（大小写敏感、双引号包围）',
      '  2. appendBuffer 并发会抛 InvalidStateError，必须等 updateend',
      '  3. sequence 模式下 timestampOffset 不生效（自动生成时间戳）',
      '  4. appendWindow 之外的帧静默丢弃，不报错（需检查 buffered）',
      '  5. changeType 跨 codec 家族（H.264 → VP9）需浏览器支持，否则抛 NotSupportedError',
    ].join('\n');
    this.setState({ sourceBufferInfo: info });
    this._addLog('mse', `SourceBuffer 与 ArrayBuffer 演示完成：codec / mode / timestampOffset / appendWindow`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. SourceBuffer 与 ArrayBuffer —— codec / mode / timestampOffset / appendWindow',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['SourceBuffer', f.sourceBuffer],
          ['MediaSource', f.mediaSource],
        ]),
        h(Tag, { color: 'primary' }, 'SourceBuffer'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'addSourceBuffer(codec) 的 codec 字符串（如 video/mp4; codecs="avc1.42E01E"）必须严格匹配分片编码。appendBuffer 接收 ArrayBuffer/ArrayBufferView。mode: segments（依赖分片时间戳，默认）/ sequence（按 append 顺序生成时间戳）。timestampOffset 偏移时间戳（用于广告拼接）。appendWindowStart/End 限制有效 append 范围（直播滑窗）。buffered 查询已缓冲范围。updating 状态防止并发 append。changeType 动态切换 codec（自适应码率）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 SourceBuffer 演示', { type: 'primary', size: 'sm', onClick: () => this._runSourceBufferDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// codec 字符串 + 能力检测
if (!MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"')) {
  throw new Error('不支持 H.264 Baseline');
}
const sb = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');

// mode + timestampOffset：广告拼接
sb.mode = 'segments';
sb.timestampOffset = 30;           // 广告从 30s 开始
sb.appendBuffer(adSegment);
sb.timestampOffset = 45;           // 主视频从 45s 继续
sb.appendBuffer(mainSegment);

// appendWindow：直播滑窗（只保留最近 60s）
sb.appendWindowEnd = 60;

// 避免并发 append：等 updateend
sb.addEventListener('updateend', () => {
  // 查询 buffered 范围
  for (let i = 0; i < sb.buffered.length; i++) {
    console.log(sb.buffered.start(i), '→', sb.buffered.end(i));
  }
}, { once: true });
sb.appendBuffer(buf);

// changeType：自适应码率切换
sb.changeType('video/webm; codecs="vp9"');`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.sourceBufferInfo || '（点击按钮查看 SourceBuffer 与 ArrayBuffer 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：自适应码率切换 =====================

  _runAdaptiveDemo() {
    const f = this._flags();
    this._injectStyle('mse-adaptive-demo', `
      .mse-adaptive-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.mediaSource) {
      this._addLog('warn', 'MediaSource 不可用，自适应码率切换仅展示模式（jsdom 无 MSE）');
    }
    if (!f.mediaCapabilities) {
      this._addLog('warn', 'navigator.mediaCapabilities 不可用，跳过解码能力探测（jsdom 无）');
    }
    const info = [
      '===== 自适应码率切换：DASH manifest / HLS m3u8 / changeType / 平滑切换 =====',
      '',
      '【自适应码率（ABR, Adaptive Bitrate Streaming）原理】',
      '  - 服务端把同一内容编码成多个码率（如 240p/480p/720p/1080p）',
      '  - 客户端根据网络带宽 / CPU / 播放器缓冲区动态选择码率',
      '  - 平滑切换：不卡顿、不黑屏、不中断音频',
      '',
      '【HLS m3u8 manifest 结构】',
      '  #EXTM3U',
      '  #EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=640x360',
      '  low.m3u8                  ← 360p 子清单',
      '  #EXT-X-STREAM-INF:BANDWIDTH=2560000,RESOLUTION=1280x720',
      '  mid.m3u8                  ← 720p 子清单',
      '  #EXT-X-STREAM-INF:BANDWIDTH=7680000,RESOLUTION=1920x1080',
      '  hi.m3u8                   ← 1080p 子清单',
      '',
      '  客户端选低/mid/hi 的子清单，再下载 ts 分片',
      '',
      '【DASH mpd manifest 结构】',
      '  <MPD>',
      '    <Period>',
      '      <AdaptationSet mimeType="video/mp4">',
      '        <Representation bandwidth="128000" codecs="avc1.42E01E" width="640" height="360">',
      '          <BaseURL>video-360p/</BaseURL>',
      '          <SegmentList>...</SegmentList>',
      '        </Representation>',
      '        <Representation bandwidth="256000" codecs="avc1.42E01E" width="1280" height="720">',
      '          ...',
      '        </Representation>',
      '      </AdaptationSet>',
      '    </Period>',
      '  </MPD>',
      '',
      '【码率切换的信号源】',
      '  1. 网络带宽估算：fetch 分片耗时 / 字节数',
      '     bandwidth = bytes / downloadTime',
      '  2. 缓冲区水位：sb.buffered.end - video.currentTime',
      '     < 5s 切到低码率，> 30s 切到高码率',
      '  3. droppedFrameCount：丢帧计数（仅 Webkit/Blink）',
      '     if (video.webkitDroppedFrameCount > 30) 切到低码率',
      '  4. mediaCapabilities.decodingInfo()：探测解码能力',
      '     const config = { type: "media-source", video: { contentType, width, height, bitrate } };',
      '     const result = await navigator.mediaCapabilities.decodingInfo(config);',
      '     result.supported; result.smooth; result.powerEfficient;',
      '',
      '【changeType 平滑切换码率】',
      '  // 切换前：等当前 SourceBuffer 空闲',
      '  if (videoSb.updating) {',
      '    await new Promise(r => videoSb.addEventListener("updateend", r, { once: true }));',
      '  }',
      '',
      '  // 切换 codec（如从 H.264 480p 切到 VP9 720p）',
      '  videoSb.changeType("video/webm; codecs=\\"vp9\\"");',
      '  // 设置 timestampOffset 对齐',
      '  videoSb.timestampOffset = video.currentTime;',
      '  // append 新码率分片',
      '  videoSb.appendBuffer(newBitrateSegment);',
      '',
      '  // 注意：跨 codec 家族切换需浏览器支持 changeType',
      '  // 同 codec 不同码率（如 H.264 480p → H.264 720p）无需 changeType，直接 append',
      '',
      '【同 codec 不同码率的平滑切换（无需 changeType）】',
      '  // 如 H.264 480p → H.264 720p（同 codec 字符串）',
      '  // 直接 append 新码率的 init segment + media segment',
      '  videoSb.appendBuffer(init720p);   // 重新初始化解码器',
      '  videoSb.appendBuffer(seg720p);    // 高码率分片',
      '  // SourceBuffer 自动处理 codec 一致性',
      '',
      '【HLS.js 实现思路（简化）】',
      '  // 1. 解析 master m3u8，拿到所有码率选项',
      '  // 2. 根据带宽/缓冲水位选择初始码率',
      '  // 3. 每隔 N 秒重新评估，决定是否切换',
      '  // 4. 切换时：append 新码率的 init + segment，移除旧缓冲',
      '',
      '【Shaka Player DASH 实现思路】',
      '  // 1. 解析 mpd，构建 Representation 列表',
      '  // 2.AbrManager 评估带宽，选择最优 Representation',
      '  // 3. 跨 codec 切换用 changeType',
      '  // 4. 同 codec 切换直接 append',
      '',
      '【浏览器支持】',
      `  MediaSource: ${f.mediaSource ? '✓' : '✗'}`,
      `  mediaCapabilities: ${f.mediaCapabilities ? '✓' : '✗'}`,
      '  changeType: Chrome 70+ / Firefox 84+ / Safari 14.1+',
      '  webkitDroppedFrameCount: 仅 Chrome/Safari/Edge（Firefox 无）',
      '',
      '【常见陷阱】',
      '  1. changeType 跨 codec 家族（H.264 → AV1）需浏览器支持，否则抛 NotSupportedError',
      '  2. 切换时必须对齐 timestampOffset，否则画面跳变',
      '  3. 移除旧缓冲时需保留少量 GOP（关键帧间隔），避免解码器断帧',
      '  4. mediaCapabilities.decodingInfo 是异步，需 await',
      '  5. Firefox 无 webkitDroppedFrameCount，需用其他信号（缓冲水位/带宽）',
    ].join('\n');
    this.setState({ adaptiveInfo: info });
    this._addLog('mse', `自适应码率切换演示完成：HLS m3u8 / DASH mpd / changeType / mediaCapabilities=${f.mediaCapabilities}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. 自适应码率切换 —— webkitDroppedFrameCount / changeType / DASH / HLS',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['MediaSource', f.mediaSource],
          ['mediaCapabilities', f.mediaCapabilities],
        ]),
        h(Tag, { color: 'primary' }, '自适应'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'HLS m3u8（EXT-X-STREAM-INF 多码率子清单）与 DASH mpd（AdaptationSet 多 Representation）是 ABR 标准格式。切换信号：网络带宽估算、缓冲水位（buffered.end - currentTime）、webkitDroppedFrameCount 丢帧计数、mediaCapabilities.decodingInfo 探测解码能力。跨 codec 家族切换（H.264 → VP9）用 changeType + timestampOffset 对齐；同 codec 不同码率（H.264 480p → 720p）直接 append init segment + media segment。平滑切换需保留少量 GOP 避免解码器断帧。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行自适应演示', { type: 'primary', size: 'sm', onClick: () => this._runAdaptiveDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// HLS m3u8 master manifest
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=640x360
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2560000,RESOLUTION=1280x720
mid.m3u8

// 自适应切换：监控丢帧 + 缓冲水位
setInterval(() => {
  const dropped = video.webkitDroppedFrameCount || 0;
  const buffered = sb.buffered.length > 0
    ? sb.buffered.end(sb.buffered.length - 1) - video.currentTime : 0;
  if (dropped > 30 || buffered < 5) {
    switchToBitrate('low');   // 降级
  } else if (buffered > 30) {
    switchToBitrate('high');  // 升级
  }
}, 3000);

// 跨 codec 切换用 changeType
if (videoSb.changeType) {
  await waitForUpdateEnd(videoSb);
  videoSb.changeType('video/webm; codecs="vp9"');
  videoSb.timestampOffset = video.currentTime;
  videoSb.appendBuffer(vp9InitSegment);
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.adaptiveInfo || '（点击按钮查看自适应码率切换完整方案）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：EME 基础与 Encrypted Media =====================

  _runEMEBasicsDemo() {
    const f = this._flags();
    this._injectStyle('mse-eme-basics-demo', `
      .mse-eme-basics-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.requestMediaKeySystemAccess) {
      this._addLog('warn', 'navigator.requestMediaKeySystemAccess 不可用，EME 演示仅展示 API 用法（jsdom 无 EME）');
    } else {
      // 真实环境：探测 Widevine 是否可用（不创建 session，避免触发 license 请求）
      this._addLog('info', '检测到 requestMediaKeySystemAccess，可真实探测 DRM 系统');
    }
    const info = [
      '===== EME 基础与 Encrypted Media：MediaKeys / MediaKeySession =====',
      '',
      '【EME 协议分层】',
      '  Application Layer    ←→ License Server（业务逻辑、license 交换）',
      '  EME API Layer        ←→ MediaKeys / MediaKeySession（浏览器 API）',
      '  CDM Layer            ←→ Content Decryption Module（厂商私有解密模块）',
      '  Media Layer          ←→ MSE SourceBuffer / video element（解码播放）',
      '',
      '【EME 核心对象】',
      '  navigator                    入口',
      '  MediaKeySystemAccess         探测 keySystem 能力（createMediaKeys）',
      '  MediaKeys                    密钥集合（createSession）',
      '  MediaKeySession              单次 DRM 会话（generateRequest / update）',
      '  MediaKeyStatusMap            密钥状态（usable/usable-downstream/...）',
      '  mediaElement.mediaKeys       当前绑定的 MediaKeys',
      '',
      '【requestMediaKeySystemAccess：EME 入口】',
      '  // 探测浏览器支持的 DRM 系统及其能力',
      '  const configs = [{',
      '    initDataTypes: ["cenc"],                  // Common Encryption',
      '    audioCapabilities: [{',
      '      contentType: \'audio/mp4; codecs="mp4a.40.2"\',',
      '      robustness: "SW_SECURE_CRYPTO",         // 安全级别',
      '    }],',
      '    videoCapabilities: [{',
      '      contentType: \'video/mp4; codecs="avc1.42E01E"\',',
      '      robustness: "SW_SECURE_CRYPTO",',
      '      encryptionScheme: "cenc",               // cenc/cbcs/cbc1/cens',
      '    }],',
      '    sessionTypes: ["temporary", "persistent-license"],',
      '    distinctiveIdentifier: "optional",         // 是否需要唯一标识',
      '    persistentState: "optional",               // 是否持久化状态',
      '  }];',
      '',
      '  let access;',
      '  try {',
      '    access = await navigator.requestMediaKeySystemAccess(',
      '      "com.widevine.alpha",  // keySystem 字符串',
      '      configs,',
      '    );',
      '  } catch (err) {',
      '    // NotSupportedError：keySystem 不支持或配置不匹配',
      '  }',
      '',
      '【keySystem 字符串清单】',
      '  com.widevine.alpha       Widevine（Google，Chrome/Android/Firefox）',
      '  com.microsoft.playready   PlayReady（Microsoft，Edge/IE/部分 Android）',
      '  com.apple.fps.1_0          FairPlay Streaming（Apple，Safari/iOS）',
      '  com.apple.fps.2_0          FairPlay Streaming v2（Safari 12.4+）',
      '  com.apple.fps              FairPlay 别名',
      '  com.adobe.primetime        Adobe Primetime（已弃用）',
      '  org.w3.clearkey            ClearKey（W3C 调试用，全平台支持）',
      '',
      '【createMediaKeys：创建 MediaKeys】',
      '  const keys = await access.createMediaKeys();',
      '  // 也可注册服务端证书（PersistentLicense 需）',
      '  await keys.setServerCertificate(serverCert);',
      '',
      '【mediaElement.setMediaKeys：绑定到 video】',
      '  await video.setMediaKeys(keys);',
      '  // 或 video.mediaKeys = keys;（部分浏览器支持）',
      '',
      '【createSession：创建 DRM 会话】',
      '  const session = keys.createSession("temporary");      // 临时会话',
      '  // 或 "persistent-license"：持久化 license（断网仍可播放）',
      '  // 或 "persistent-usage-record"：使用记录持久化',
      '',
      '【generateRequest：发起 license 请求】',
      '  // 由 mediaElement 的 encrypted 事件触发',
      '  video.addEventListener("encrypted", async (e) => {',
      '    // e.initDataType: "cenc" / "webm" / "keyids"',
      '    // e.initData: ArrayBuffer（PSSH 盒子）',
      '    const session = keys.createSession();',
      '    session.addEventListener("message", onMessage);     // license 请求',
      '    session.addEventListener("keystatuseschange", onKeyStatus);',
      '    await session.generateRequest(e.initDataType, e.initData);',
      '  });',
      '',
      '【完整的 EME 初始化流程】',
      '  async function initEME(video) {',
      '    const access = await navigator.requestMediaKeySystemAccess(',
      '      "com.widevine.alpha",',
      '      [{',
      '        initDataTypes: ["cenc"],',
      '        audioCapabilities: [{ contentType: \'audio/mp4; codecs="mp4a.40.2"\' }],',
      '        videoCapabilities: [{ contentType: \'video/mp4; codecs="avc1.42E01E"\' }],',
      '      }],',
      '    );',
      '    const keys = await access.createMediaKeys();',
      '    await video.setMediaKeys(keys);',
      '    video.addEventListener("encrypted", async (e) => {',
      '      const session = keys.createSession();',
      '      session.addEventListener("message", async (msg) => {',
      '        const license = await fetchLicense(msg.message);',
      '        await session.update(license);  // 注入 license',
      '      });',
      '      await session.generateRequest(e.initDataType, e.initData);',
      '    });',
      '  }',
      '',
      '【encryptionScheme：cenc / cbcs / cbc1 / cens】',
      '  cenc  AES-CTR 全样本加密（CTR 模式）',
      '  cens  AES-CTR + 部分加密',
      '  cbc1  AES-CBC 全样本加密',
      '  cbcs  AES-CBC + 部分加密（Apple FairPlay 默认）',
      '',
      '【robustness 安全级别】',
      '  SW_SECURE_CRYPTO     软件解密（最低）',
      '  SW_SECURE_DECODE     软件解码',
      '  HW_SECURE_CRYPTO     硬件解密',
      '  HW_SECURE_DECODE     硬件解码',
      '  HW_SECURE_ALL        全硬件安全（最高）',
      '',
      '【浏览器支持】',
      `  MediaKeys: ${f.mediaKeys ? '✓' : '✗'}`,
      `  requestMediaKeySystemAccess: ${f.requestMediaKeySystemAccess ? '✓' : '✗'}`,
      `  MediaKeySession: ${f.mediaKeySession ? '✓' : '✗'}`,
      `  MediaKeySystemAccess: ${f.mediaKeySystemAccess ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. requestMediaKeySystemAccess 是 Promise，必须 await 拿到 access',
      '  2. configs 不匹配会 NotSupportedError（如 keySystem 不支持该 codec）',
      '  3. setMediaKeys 必须在 video.src 设置前调用（或 encrypted 事件前）',
      '  4. generateRequest 必须在 encrypted 事件回调内调用，拿到 initData',
      '  5. persistent-license 需 license server 配合 + setServerCertificate',
    ].join('\n');
    this.setState({ emeBasicsInfo: info });
    this._addLog('eme', `EME 基础演示完成：requestMediaKeySystemAccess=${f.requestMediaKeySystemAccess}，MediaKeys=${f.mediaKeys}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. EME 基础与 Encrypted Media —— requestMediaKeySystemAccess / MediaKeys / MediaKeySession',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['requestMKSA', f.requestMediaKeySystemAccess],
          ['MediaKeys', f.mediaKeys],
          ['MediaKeySession', f.mediaKeySession],
        ]),
        h(Tag, { color: 'primary' }, 'EME 基础'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'EME 协议分层：Application（业务/license 交换）→ EME API（MediaKeys/MediaKeySession）→ CDM（厂商解密模块）→ Media（MSE SourceBuffer）。navigator.requestMediaKeySystemAccess(keySystem, configs) 探测 DRM 系统（com.widevine.alpha/com.microsoft.playready/com.apple.fps/org.w3.clearkey），createMediaKeys 创建 MediaKeys，setMediaKeys 绑定到 video，createSession 创建会话，generateRequest 发起 license 请求。encryptionScheme（cenc/cbcs/cbc1/cens）+ robustness（SW/HW_SECURE_*）控制安全级别。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 EME 基础演示', { type: 'primary', size: 'sm', onClick: () => this._runEMEBasicsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// EME 初始化流程
const access = await navigator.requestMediaKeySystemAccess(
  'com.widevine.alpha',
  [{
    initDataTypes: ['cenc'],
    audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
    videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
    sessionTypes: ['temporary', 'persistent-license'],
  }],
);
const keys = await access.createMediaKeys();
await video.setMediaKeys(keys);

// encrypted 事件触发 license 交换
video.addEventListener('encrypted', async (e) => {
  const session = keys.createSession('temporary');
  session.addEventListener('message', async (msg) => {
    const license = await fetch('/license', { method: 'POST', body: msg.message });
    await session.update(await license.arrayBuffer());
  });
  session.addEventListener('keystatuseschange', () => {
    session.keyStatuses.forEach((status, keyId) => {
      console.log('key', keyId, '→', status); // 'usable' / 'expired'
    });
  });
  await session.generateRequest(e.initDataType, e.initData);
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.emeBasicsInfo || '（点击按钮查看 EME 基础与 Encrypted Media 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：Widevine/PlayReady/FairPlay =====================

  _runDRMSystemsDemo() {
    const f = this._flags();
    this._injectStyle('mse-drm-systems-demo', `
      .mse-drm-systems-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== Widevine / PlayReady / FairPlay：DRM 系统对比 =====',
      '',
      '【三大 DRM 系统对比】',
      '  维度            Widevine              PlayReady              FairPlay',
      '  ---------------------------------------------------------------------------',
      '  厂商            Google                Microsoft               Apple',
      '  keySystem       com.widevine.alpha    com.microsoft.playready com.apple.fps',
      '  主浏览器         Chrome/Android/Firefox Edge/IE               Safari/iOS',
      '  encryptionScheme cenc/cbcs            cenc                    cbcs',
      '  安全级别         L1/L3                SL2000/SL3000          所有 FPS 设备',
      '  license server   自定义               自定义                  自定义 + FPS cert',
      '  持久化           persistent-license   persistent             persistent',
      '  CDM              Widevine CDM         PlayReady CDM          FPS CDM',
      '',
      '【Widevine 安全级别（L1/L3）】',
      '  L3  软件解密',
      '    - CDM 在用户态运行，密钥在内存',
      '    - 几乎所有桌面 Chrome/Edge 支持',
      '    - 防护级别低，适合普通内容',
      '  L1  硬件解密',
      '    - CDM 在 Trusted Execution Environment（TEE）运行',
      '    - 密钥不离开硬件（如 ARM TrustZone / Intel SGX）',
      '    - 视频解密后不进入应用内存，直接送显示',
      '    - 高价值内容（4K/早期窗口电影）必须 L1',
      '  // 探测安全级别',
      '  const access = await navigator.requestMediaKeySystemAccess(',
      '    "com.widevine.alpha",',
      '    [{',
      '      videoCapabilities: [{',
      '        contentType: \'video/mp4; codecs="avc1.42E01E"\',',
      '        robustness: "HW_SECURE_ALL",  // 要求 L1',
      '      }],',
      '    }],',
      '  );',
      '  // access.getConfiguration().videoCapabilities[0].robustness 实际匹配的级别',
      '',
      '【PlayReady 安全级别（SL2000/SL3000）】',
      '  SL2000  软件解密（Windows 桌面）',
      '  SL3000  硬件解密（Windows 10+ / Xbox / 部分 Android）',
      '  // PlayReady 是 Windows 生态默认 DRM',
      '  const access = await navigator.requestMediaKeySystemAccess(',
      '    "com.microsoft.playready",',
      '    [{',
      '      initDataTypes: ["cenc"],',
      '      videoCapabilities: [{',
      '        contentType: \'video/mp4; codecs="avc1.42E01E"\',',
      '        robustness: "3000",  // SL3000',
      '      }],',
      '    }],',
      '  );',
      '',
      '【FairPlay Streaming (FPS)】',
      '  // Apple 专属 DRM，仅 Safari/iOS 支持',
      '  // 必须先获取 FPS certificate，再传入 createMediaKeys',
      '  const fpsCert = await fetchFPS_CERT();',
      '  const access = await navigator.requestMediaKeySystemAccess(',
      '    "com.apple.fps",',
      '    [{',
      '      initDataTypes: ["cenc"],',
      '      videoCapabilities: [{',
      '        contentType: \'video/mp4; codecs="avc1.42E01E"\',',
      '        robustness: "SW_SECURE_DECODE",',
      '        encryptionScheme: "cbcs",  // FairPlay 必须 cbcs',
      '      }],',
      '    }],',
      '  );',
      '  const keys = await access.createMediaKeys();',
      '  await keys.setServerCertificate(fpsCert);  // 必须设',
      '',
      '  注意：FairPlay 流程略不同，license 请求需 streaming-mode header',
      '',
      '【license server 交互】',
      '  // 通用流程：',
      '  // 1. session.generateRequest 触发 message 事件',
      '  // 2. message.message 是 base64 编码的 license 请求体',
      '  // 3. POST 到 license server，带 Content-Type 与自定义 header',
      '  // 4. 返回的 license 用 session.update 注入',
      '',
      '  async function fetchLicense(challenge) {',
      '    const resp = await fetch("https://license.example.com/widevine", {',
      '      method: "POST",',
      '      headers: {',
      '        "Content-Type": "application/octet-stream",',
      '        "Authorization": "Bearer " + token,',
      '      },',
      '      body: challenge,  // ArrayBuffer',
      '    });',
      '    return await resp.arrayBuffer();',
      '  }',
      '',
      '【persistent-license：临时 vs 持久】',
      '  // 临时：会话关闭即丢失，下次播放需重新请求 license',
      '  const session = keys.createSession("temporary");',
      '',
      '  // 持久：license 持久化到 IndexedDB，断网仍可播放',
      '  const persistentSession = keys.createSession("persistent-license");',
      '  // 加载已有 session',
      '  const sessionId = "saved-session-id";',
      '  const loaded = await persistentSession.load(sessionId);  // true=已加载',
      '  // 移除',
      '  await persistentSession.remove();  // 删除持久化 license',
      '',
      '【防盗链与 token】',
      '  - license server 必须验证请求来源（Origin / Referer）',
      '  - 短期 token（JWT）防止 license 滥用',
      '  - 设备指纹（distinctiveIdentifier）绑定硬件',
      '',
      '【多 DRM 兼容（同时支持 Widevine + PlayReady + FairPlay）】',
      '  // 服务端打包时嵌入多个 PSSH（Protection System Specific Header）',
      '  // 客户端按浏览器选择支持的 keySystem',
      '  const keySystems = [',
      '    "com.widevine.alpha",',
      '    "com.microsoft.playready",',
      '    "com.apple.fps",',
      '    "org.w3.clearkey",',
      '  ];',
      '  let access;',
      '  for (const ks of keySystems) {',
      '    try {',
      '      access = await navigator.requestMediaKeySystemAccess(ks, configs);',
      '      break;',
      '    } catch { /* try next */ }',
      '  }',
      '',
      '【浏览器支持】',
      `  requestMediaKeySystemAccess: ${f.requestMediaKeySystemAccess ? '✓' : '✗'}`,
      '  Widevine: Chrome/Android/Firefox',
      '  PlayReady: Edge/IE/部分 Android',
      '  FairPlay: Safari/iOS',
      '  ClearKey: 全平台（调试用）',
      '',
      '【常见陷阱】',
      '  1. FairPlay 必须 cbcs + setServerCertificate，与其他 DRM 不同',
      '  2. robustness HW_SECURE_ALL 在 L3 设备上会 NotSupportedError',
      '  3. persistent-license 在隐身模式可能受限',
      '  4. 多 DRM 需服务端打包时嵌入所有 PSSH，否则客户端探测失败',
      '  5. license server 必须验证 token + 设备指纹，否则 license 被滥用',
    ].join('\n');
    this.setState({ drmSystemsInfo: info });
    this._addLog('eme', `DRM 系统对比演示完成：Widevine L1/L3 + PlayReady SL2000/SL3000 + FairPlay FPS`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. Widevine/PlayReady/FairPlay —— DRM 系统对比 / L1/L3 / SL2000/SL3000 / FPS',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['requestMKSA', f.requestMediaKeySystemAccess],
          ['MediaKeys', f.mediaKeys],
        ]),
        h(Tag, { color: 'primary' }, '三大 DRM'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '三大 DRM 系统：Widevine（Google，Chrome/Android/Firefox，L1 硬件/L3 软件）、PlayReady（Microsoft，Edge/IE，SL2000 软件/SL3000 硬件）、FairPlay Streaming（Apple，Safari/iOS，必须 cbcs + setServerCertificate）。license server 交互：session.message 事件触发，POST challenge 到 server，返回 license 用 session.update 注入。persistent-license 持久化到 IndexedDB（断网可播放），load/remove 管理。多 DRM 兼容：服务端打包多 PSSH，客户端按 keySystem 探测。防盗链需 token + 设备指纹。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 DRM 系统对比演示', { type: 'primary', size: 'sm', onClick: () => this._runDRMSystemsDemo() }),
        ),
        // 三大 DRM 速查矩阵
        h('div', { class: 'mse-matrix' },
          h('div', { class: 'mse-matrix-cell' },
            h('div', { class: 'mse-matrix-title' }, 'Widevine'),
            h('div', {}, 'Google · Chrome/Android · L1硬件/L3软件 · cenc/cbcs'),
          ),
          h('div', { class: 'mse-matrix-cell' },
            h('div', { class: 'mse-matrix-title' }, 'PlayReady'),
            h('div', {}, 'Microsoft · Edge/IE · SL2000软件/SL3000硬件 · cenc'),
          ),
          h('div', { class: 'mse-matrix-cell' },
            h('div', { class: 'mse-matrix-title' }, 'FairPlay'),
            h('div', {}, 'Apple · Safari/iOS · 必须cbcs + FPS证书'),
          ),
          h('div', { class: 'mse-matrix-cell' },
            h('div', { class: 'mse-matrix-title' }, 'ClearKey'),
            h('div', {}, 'W3C 调试用 · 全平台 · 明文 key'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 探测 Widevine 安全级别（L1 vs L3）
const access = await navigator.requestMediaKeySystemAccess(
  'com.widevine.alpha',
  [{
    videoCapabilities: [{
      contentType: 'video/mp4; codecs="avc1.42E01E"',
      robustness: 'HW_SECURE_ALL', // 要求 L1
    }],
  }],
);
// 实际匹配的 robustness 决定 L1/L3

// FairPlay 必须 setServerCertificate
const fpsCert = await fetchFPS_CERT();
const fpsAccess = await navigator.requestMediaKeySystemAccess(
  'com.apple.fps',
  [{
    videoCapabilities: [{
      contentType: 'video/mp4; codecs="avc1.42E01E"',
      encryptionScheme: 'cbcs', // FairPlay 必须
    }],
  }],
);
const fpsKeys = await fpsAccess.createMediaKeys();
await fpsKeys.setServerCertificate(fpsCert);

// 多 DRM 兼容：按浏览器自动选择
for (const ks of ['com.widevine.alpha', 'com.microsoft.playready', 'com.apple.fps']) {
  try { return await navigator.requestMediaKeySystemAccess(ks, configs); }
  catch { /* try next */ }
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.drmSystemsInfo || '（点击按钮查看三大 DRM 系统对比完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：license 交换流程 =====================

  _runLicenseDemo() {
    const f = this._flags();
    this._injectStyle('mse-license-demo', `
      .mse-license-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.mediaKeySession) {
      this._addLog('warn', 'MediaKeySession 不可用，license 交换仅展示流程（jsdom 无 EME）');
    }
    const info = [
      '===== license 交换流程：generateRequest / message / update / keystatuseschange =====',
      '',
      '【license 交换时序】',
      '  video (MSE append 加密分片)',
      '    │',
      '    │ encrypted 事件 (initData / PSSH)',
      '    ▼',
      '  session.generateRequest(initDataType, initData)',
      '    │',
      '    │ message 事件 (license challenge)',
      '    ▼',
      '  fetch(licenseServer, { body: challenge })',
      '    │',
      '    │ license response',
      '    ▼',
      '  session.update(license)',
      '    │',
      '    │ keystatuseschange 事件',
      '    ▼',
      '  keys → "usable" → CDM 解密 → video 播放',
      '',
      '【generateRequest(initDataType, initData)】',
      '  // 由 encrypted 事件触发，initData 通常是 PSSH 盒子',
      '  video.addEventListener("encrypted", async (e) => {',
      '    // e.initDataType: "cenc" / "webm" / "keyids"',
      '    // e.initData: ArrayBuffer（PSSH 数据）',
      '    const session = keys.createSession("temporary");',
      '    session.addEventListener("message", onLicenseMessage);',
      '    session.addEventListener("keystatuseschange", onKeyStatus);',
      '    await session.generateRequest(e.initDataType, e.initData);',
      '    // generateRequest 触发 message 事件',
      '  });',
      '',
      '【initDataType 与 initData】',
      '  cenc    Common Encryption (PSSH box)，最通用',
      '  webm    WebM 格式（Google）',
      '  keyids  手动指定 key IDs（ClearKey 调试用）',
      '',
      '  // ClearKey 调试：手动构造 initData',
      '  const keyId = "abcdef0123456789...";',
      '  const initData = new TextEncoder().encode(JSON.stringify({ kids: [base64(keyId)] }));',
      '  await session.generateRequest("keyids", initData.buffer);',
      '',
      '【message 事件：license challenge】',
      '  // message 事件触发后，event.message 是 license 请求体',
      '  // event.messageType: "license-request" / "license-renewal" / "license-release" / "individualization-request"',
      '  async function onLicenseMessage(event) {',
      '    const { message, messageType } = event;',
      '    // POST 到 license server',
      '    const resp = await fetch("https://license.example.com/widevine", {',
      '      method: "POST",',
      '      headers: {',
      '        "Content-Type": "application/octet-stream",',
      '        "Authorization": "Bearer " + authToken,',
      '      },',
      '      body: message,  // ArrayBuffer',
      '    });',
      '    const license = await resp.arrayBuffer();',
      '    // 注入 license',
      '    await session.update(license);',
      '  }',
      '',
      '【update(response)：注入 license】',
      '  // response 是 license server 返回的二进制数据',
      '  await session.update(license);',
      '  // update 成功后触发 keystatuseschange 事件',
      '',
      '【keystatuseschange 事件：密钥状态】',
      '  session.addEventListener("keystatuseschange", () => {',
      '    session.keyStatuses.forEach((status, keyId) => {',
      '      console.log("key", keyId, "status", status);',
      '      // status 可能值：',
      '      // "usable"               可用，CDM 可解密',
      '      // "usable-downstream"     可用且可传给下游',
      '      // "status-pending"        等待 license',
      '      // "expired"              已过期',
      '      // "output-not-allowed"   不允许输出（如 HDCP 失败）',
      '      // "output-downscaled"    降级输出',
      '      // "released"             已释放',
      '      // "status-deny"          拒绝',
      '    });',
      '  });',
      '',
      '【ClearKey 调试（无需 license server）】',
      '  // W3C 标准，所有浏览器支持，明文 key 适合调试',
      '  const access = await navigator.requestMediaKeySystemAccess(',
      '    "org.w3.clearkey",',
      '    [{',
      '      initDataTypes: ["keyids"],',
      '      videoCapabilities: [{ contentType: \'video/mp4; codecs="avc1.42E01E"\' }],',
      '    }],',
      '  );',
      '  const keys = await access.createMediaKeys();',
      '  await video.setMediaKeys(keys);',
      '',
      '  video.addEventListener("encrypted", async (e) => {',
      '    const session = keys.createSession();',
      '    session.addEventListener("message", async (msg) => {',
      '      // ClearKey 的 message 是 JSON 格式的 license 请求',
      '      const request = JSON.parse(new TextDecoder().decode(msg.message));',
      '      // 用明文 key 构造响应',
      '      const key = "0123456789abcdef0123456789abcdef";',
      '      const response = {',
      '        keys: [{ kty: "oct", kid: request.kids[0], k: base64url(key) }],',
      '        type: "temporary",',
      '      };',
      '      const license = new TextEncoder().encode(JSON.stringify(response));',
      '      await session.update(license.buffer);',
      '    });',
      '    await session.generateRequest(e.initDataType, e.initData);',
      '  });',
      '',
      '【encrypted 事件 → MediaKeyNeeded】',
      '  // 旧版 EME 用 mediaElement.onwebkitneedkey / msneedkey',
      '  // 现代统一为 encrypted 事件',
      '  // 触发时机：MSE append 加密分片后，CDM 检测到加密内容',
      '  // initData 来源：mp4 的 moov box 中的 PSSH（Protection System Specific Header）',
      '',
      '【完整的 license 交换代码】',
      '  async function setupDRM(video, keySystem) {',
      '    const access = await navigator.requestMediaKeySystemAccess(keySystem, configs);',
      '    const keys = await access.createMediaKeys();',
      '    await video.setMediaKeys(keys);',
      '',
      '    video.addEventListener("encrypted", async (e) => {',
      '      const session = keys.createSession("temporary");',
      '      session.addEventListener("message", async (msg) => {',
      '        const license = await fetchLicense(msg.message);',
      '        await session.update(license);',
      '      });',
      '      session.addEventListener("keystatuseschange", () => {',
      '        session.keyStatuses.forEach((status, kid) => {',
      '          if (status === "usable") console.log("key 可用，开始解密");',
      '        });',
      '      });',
      '      await session.generateRequest(e.initDataType, e.initData);',
      '    });',
      '  }',
      '',
      '【浏览器支持】',
      `  MediaKeySession: ${f.mediaKeySession ? '✓' : '✗'}`,
      `  requestMediaKeySystemAccess: ${f.requestMediaKeySystemAccess ? '✓' : '✗'}`,
      '  ClearKey: 全平台（Chrome/Firefox/Safari/Edge）',
      '',
      '【常见陷阱】',
      '  1. generateRequest 必须在 encrypted 事件内调用，initData 是一次性的',
      '  2. message 事件的 message 是 ArrayBuffer，POST 时直接做 body',
      '  3. license server 返回必须 application/octet-stream，不能用 JSON 包装',
      '  4. ClearKey 仅调试用，不能用于生产（明文 key 易被逆向）',
      '  5. keystatuseschange 的 status="output-not-allowed" 通常是 HDCP 失败',
    ].join('\n');
    this.setState({ licenseInfo: info });
    this._addLog('eme', `license 交换流程演示完成：generateRequest → message → update → keystatuseschange`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. license 交换流程 —— generateRequest / message / update / keystatuseschange / ClearKey',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['MediaKeySession', f.mediaKeySession],
          ['requestMKSA', f.requestMediaKeySystemAccess],
        ]),
        h(Tag, { color: 'primary' }, 'license 交换'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'license 交换时序：encrypted 事件 → generateRequest(initDataType, initData) → message 事件（license challenge）→ fetch license server → session.update(license) → keystatuseschange 事件（status="usable" 后 CDM 解密）。initDataType：cenc（PSSH）/ webm / keyids（ClearKey 调试）。messageType：license-request/renewal/release。ClearKey 用明文 key 调试，无需真实 license server。keystatuseschange 的 status：usable/expired/output-not-allowed（HDCP 失败）等。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 license 交换演示', { type: 'primary', size: 'sm', onClick: () => this._runLicenseDemo() }),
        ),
        // license 交换流程图
        h('div', { class: 'mse-flow' },
          h('span', { class: 'mse-flow-node' }, 'encrypted'),
          h('span', { class: 'mse-flow-arrow' }, '→'),
          h('span', { class: 'mse-flow-node mse-flow-node--eme' }, 'generateRequest'),
          h('span', { class: 'mse-flow-arrow' }, '→'),
          h('span', { class: 'mse-flow-node mse-flow-node--eme' }, 'message'),
          h('span', { class: 'mse-flow-arrow' }, '→'),
          h('span', { class: 'mse-flow-node' }, 'license server'),
          h('span', { class: 'mse-flow-arrow' }, '→'),
          h('span', { class: 'mse-flow-node mse-flow-node--eme' }, 'update'),
          h('span', { class: 'mse-flow-arrow' }, '→'),
          h('span', { class: 'mse-flow-node mse-flow-node--eme' }, 'keystatuseschange'),
          h('span', { class: 'mse-flow-arrow' }, '→'),
          h('span', { class: 'mse-flow-node' }, 'usable'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 完整 license 交换流程
video.addEventListener('encrypted', async (e) => {
  const session = keys.createSession('temporary');

  // 1. message 事件 → POST 到 license server
  session.addEventListener('message', async (msg) => {
    const resp = await fetch('https://license.example.com/widevine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': 'Bearer ' + token,
      },
      body: msg.message, // ArrayBuffer challenge
    });
    const license = await resp.arrayBuffer();
    // 2. 注入 license
    await session.update(license);
  });

  // 3. 监听密钥状态
  session.addEventListener('keystatuseschange', () => {
    session.keyStatuses.forEach((status, kid) => {
      console.log('kid', kid, '→', status);
      // 'usable' / 'expired' / 'output-not-allowed'
    });
  });

  // 4. 发起 license 请求
  await session.generateRequest(e.initDataType, e.initData);
});

// ClearKey 调试（无需真实 license server）
const ckAccess = await navigator.requestMediaKeySystemAccess(
  'org.w3.clearkey', [{
    initDataTypes: ['keyids'],
    videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
  }],
);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.licenseInfo || '（点击按钮查看 license 交换流程完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：实战与陷阱 =====================

  _runPitfallsDemo() {
    const f = this._flags();
    this._injectStyle('mse-pitfalls-demo', `
      .mse-pitfalls-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== 实战与陷阱：HLS.js / Shaka Player / 防盗链 / CORS / seek =====',
      '',
      '【实战 1：HLS.js + MSE】',
      '  // HLS.js 把 m3u8 解析 + ts 分片 fetch + MSE append 全部封装',
      '  const video = document.querySelector("video");',
      '  if (video.canPlayType("application/vnd.apple.mpegurl")) {',
      '    // Safari 原生支持 HLS（无需 MSE）',
      '    video.src = "stream.m3u8";',
      '  } else if (window.Hls) {',
      '    // 其他浏览器用 HLS.js',
      '    const hls = new Hls();',
      '    hls.loadSource("stream.m3u8");',
      '    hls.attachMedia(video);',
      '    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());',
      '    // 自适应码率切换',
      '    hls.currentLevel = -1; // -1 = ABR 自动',
      '  }',
      '',
      '【实战 2：Shaka Player DASH】',
      '  // Shaka Player 把 mpd 解析 + 分片 fetch + MSE append 封装',
      '  const player = new shaka.Player(video);',
      '  await player.load("stream.mpd");',
      '  // 自适应码率',
      '  player.configure({',
      '    abr: {',
      '      enabled: true,',
      '      defaultBandwidthEstimate: 1000000, // 1 Mbps',
      '      switchInterval: 8, // 8 秒评估一次',
      '    },',
      '  });',
      '',
      '【实战 3：防盗链与 token】',
      '  // license server 验证 token + Origin',
      '  async function fetchLicense(challenge) {',
      '    const token = await getShortLivedToken();  // JWT 短期 token',
      '    const resp = await fetch("https://license.example.com/widevine", {',
      '      method: "POST",',
      '      headers: {',
      '        "Content-Type": "application/octet-stream",',
      '        "Authorization": "Bearer " + token,',
      '        "X-Origin": location.origin,  // 服务端校验',
      '      },',
      '      body: challenge,',
      '    });',
      '    return await resp.arrayBuffer();',
      '  }',
      '',
      '  // 服务端校验（伪代码）：',
      '  // 1. JWT 签名验证 + 过期检查',
      '  // 2. Origin 白名单（防止跨站 license 滥用）',
      '  // 3. distinctiveIdentifier 设备指纹（绑定硬件）',
      '  // 4. 限流（rate limit）防止暴力枚举',
      '',
      '【实战 4：跨域 CORS】',
      '  // 分片 fetch 跨域必须 CORS',
      '  // 服务端：',
      '  //   Access-Control-Allow-Origin: https://player.example.com',
      '  //   Access-Control-Allow-Credentials: true（带 cookie 时）',
      '',
      '  // license server 同样需 CORS',
      '  fetch("https://license.example.com/widevine", {',
      '    mode: "cors",',
      '    credentials: "include",  // 带 cookie',
      '    ...',
      '  });',
      '',
      '【实战 5：MediaSource 跨浏览器 codec 兼容性】',
      '  // 探测浏览器支持的 codec，按优先级选择',
      '  const codecs = [',
      '    \'video/mp4; codecs="avc1.640028"\',  // H.264 High 4.0',
      '    \'video/mp4; codecs="avc1.4d401f"\',  // H.264 Main 3.1',
      '    \'video/mp4; codecs="avc1.42E01E"\',  // H.264 Baseline 3.0',
      '    \'video/webm; codecs="vp9"\',         // VP9',
      '    \'video/webm; codecs="vp8"\',         // VP8',
      '  ];',
      '  const codec = codecs.find(c => MediaSource.isTypeSupported(c));',
      '  if (!codec) throw new Error("无支持的 codec");',
      '  const sb = mediaSource.addSourceBuffer(codec);',
      '',
      '【实战 6：拖拽 seek 处理】',
      '  // seek 时需 append 对应时间点的分片',
      '  video.addEventListener("seeking", async () => {',
      '    const target = video.currentTime;',
      '    // 检查是否在已缓冲范围',
      '    const buffered = sb.buffered;',
      '    let inBuffer = false;',
      '    for (let i = 0; i < buffered.length; i++) {',
      '      if (target >= buffered.start(i) && target <= buffered.end(i)) {',
      '        inBuffer = true; break;',
      '      }',
      '    }',
      '    if (!inBuffer) {',
      '      // 移除旧缓冲',
      '      sb.remove(0, video.duration);',
      '      await waitForUpdateEnd(sb);',
      '      // 加载目标时间点的分片（需 manifest 索引）',
      '      const segmentUrl = findSegmentForTime(manifest, target);',
      '      const buf = await (await fetch(segmentUrl)).arrayBuffer();',
      '      sb.appendBuffer(buf);',
      '    }',
      '  });',
      '',
      '【实战 7：加密内容与 ClearKey 调试】',
      '  // 开发阶段用 ClearKey 调试（无需真实 license server）',
      '  // 1. 用 ffmpeg 加密 mp4（cenc 方案）',
      '  //    ffmpeg -i input.mp4 -encryption_scheme cenc -encryption_key 0123456789abcdef0123456789abcdef -encryption_kid 0123456789abcdef0123456789abcdef encrypted.mp4',
      '  // 2. 前端用 ClearKey 解密',
      '  const access = await navigator.requestMediaKeySystemAccess("org.w3.clearkey", [{',
      '    initDataTypes: ["keyids"],',
      '    videoCapabilities: [{ contentType: \'video/mp4; codecs="avc1.42E01E"\' }],',
      '  }]);',
      '  // 3. license 响应直接用明文 key 构造（见 Card 7）',
      '',
      '【常见陷阱清单】',
      '  1. iOS Safari MSE 支持受限，HLS 推荐用原生 <video src="m3u8">',
      '  2. Safari 的 FairPlay 必须 cbcs + setServerCertificate',
      '  3. license server 返回必须 application/octet-stream，不能用 JSON',
      '  4. CORS 必须配置，否则分片与 license 请求被拦截',
      '  5. seek 时必须检查 buffered 范围，未缓冲需 append 新分片',
      '  6. clearType 跨 codec 家族需浏览器支持（Safari 14.1 之前不支持）',
      '  7. persistent-license 在隐身模式可能失败',
      '  8. webkitDroppedFrameCount 仅 Chrome/Safari/Edge，Firefox 无',
      '  9. duration 设为 Infinity 后必须显式设回才能 endOfStream',
      ' 10. blob: URL 在 mediaSource 销毁后失效，需 revokeObjectURL',
      '',
      '【性能优化】',
      '  ✓ 用 Web Worker fetch 分片（避免主线程阻塞）',
      '  ✓ remove 已播放分片节省内存（移动端重要）',
      '  ✓ appendWindowEnd 实现直播滑窗',
      '  ✓ preload 探测下一码率分片',
      '  ✓ reuse MediaKeySession 复用 license（避免重复握手）',
      '',
      '【浏览器支持总览】',
      `  MediaSource: ${f.mediaSource ? '✓' : '✗'}`,
      `  MediaKeys: ${f.mediaKeys ? '✓' : '✗'}`,
      `  requestMediaKeySystemAccess: ${f.requestMediaKeySystemAccess ? '✓' : '✗'}`,
      `  mediaCapabilities: ${f.mediaCapabilities ? '✓' : '✗'}`,
    ].join('\n');
    this.setState({ pitfallsInfo: info });
    this._addLog('mse', `实战与陷阱演示完成：HLS.js + Shaka Player + 防盗链 + CORS + seek + ClearKey 调试`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战与陷阱 —— HLS.js / Shaka Player / 防盗链 / CORS / seek / ClearKey',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['MediaSource', f.mediaSource],
          ['MediaKeys', f.mediaKeys],
        ]),
        h(Tag, { color: 'warning' }, '实战 + 陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '实战：HLS.js（m3u8 解析 + ts fetch + MSE append）与 Shaka Player（DASH mpd）封装完整流程，Safari 原生 HLS 用 video.src。防盗链需 license server 校验 JWT token + Origin 白名单 + 限流。跨域 CORS 必须配置（Access-Control-Allow-Origin + credentials）。MediaSource 跨浏览器 codec 兼容用 isTypeSupported 探测优先级。seek 时检查 buffered 范围，未缓冲需 append 新分片。ClearKey 用 ffmpeg 加密 + 明文 key 调试。10 大陷阱清单覆盖 iOS Safari 限制、FairPlay 证书、CORS、seek、changeType、persistent-license。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战与陷阱演示', { type: 'primary', size: 'sm', onClick: () => this._runPitfallsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// HLS.js 实战
if (video.canPlayType('application/vnd.apple.mpegurl')) {
  video.src = 'stream.m3u8'; // Safari 原生
} else if (window.Hls) {
  const hls = new Hls();
  hls.loadSource('stream.m3u8');
  hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
}

// Shaka Player DASH
const player = new shaka.Player(video);
await player.load('stream.mpd');
player.configure({ abr: { enabled: true, switchInterval: 8 } });

// 防盗链：license server 带 JWT token
async function fetchLicense(challenge) {
  const resp = await fetch('https://license.example.com/widevine', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Authorization': 'Bearer ' + await getShortLivedToken(),
    },
    body: challenge,
  });
  return await resp.arrayBuffer();
}

// codec 兼容探测
const codec = [
  'video/mp4; codecs="avc1.640028"',
  'video/mp4; codecs="avc1.42E01E"',
  'video/webm; codecs="vp9"',
].find(c => MediaSource.isTypeSupported(c));
const sb = mediaSource.addSourceBuffer(codec);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看实战与陷阱完整说明）')),
        h(Alert, {
          type: 'warning',
          message: 'iOS Safari MSE 支持受限，HLS 推荐原生 src；FairPlay 必须 cbcs + 证书',
          description: '10 大陷阱：iOS Safari MSE 限制 / FairPlay cbcs + 证书 / license server octet-stream / CORS 必配 / seek 检查 buffered / changeType 跨 codec 需 14.1+ / persistent-license 隐身模式失败 / webkitDroppedFrameCount 仅 Blink / duration Infinity 后需重置 / blob: URL 需 revokeObjectURL。性能优化：Worker fetch 分片 / remove 已播放 / appendWindow 直播滑窗 / preload 下一码率 / reuse MediaKeySession。',
        }),
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

  // ===================== 渲染入口 =====================

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'MSE + EME 流媒体与 DRM 完整实验室'),

      h(Alert, {
        type: 'info',
        message: 'MSE + EME —— Media Source Extensions 与 Encrypted Media Extensions 深度实验室',
        description: '演示 MSE（W3C Media Source Extensions，可编程媒体源，支撑 HLS/DASH 自适应码率）与 EME（W3C Encrypted Media Extensions，DRM license 交换与解密）：MediaSource 生命周期（new MediaSource + URL.createObjectURL + sourceopen + addSourceBuffer + appendBuffer + remove + endOfStream + duration）、SourceBuffer 与 ArrayBuffer（codec 字符串 avc1.42E01E / mode segments vs sequence / timestampOffset 广告拼接 / appendWindow 直播滑窗 / buffered 查询 / updating 防并发 / changeType 跨 codec 切换）、自适应码率切换（HLS m3u8 / DASH mpd / webkitDroppedFrameCount 丢帧 / mediaCapabilities.decodingInfo / changeType 平滑切换）、EME 基础（requestMediaKeySystemAccess / MediaKeys / MediaKeySession / keySystem 字符串 com.widevine.alpha / encryptionScheme cenc/cbcs / robustness SW/HW_SECURE_*）、三大 DRM 系统（Widevine L1/L3 + PlayReady SL2000/SL3000 + FairPlay Streaming + ClearKey 调试 + persistent-license 临时 vs 持久）、license 交换流程（encrypted 事件 → generateRequest → message → fetch license server → update → keystatuseschange status=usable → CDM 解密）、实战与陷阱（HLS.js + Shaka Player + 防盗链 token + CORS + codec 兼容探测 + seek 处理 + ClearKey 调试 + 10 大陷阱）。jsdom 无 MediaSource/EME 所有检测为 false，仅记日志绝不抛异常；真实浏览器可完整体验。',
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
