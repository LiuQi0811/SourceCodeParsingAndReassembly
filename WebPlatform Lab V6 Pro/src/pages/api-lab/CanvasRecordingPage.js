// =====================================================================
// CanvasRecordingPage.js —— Canvas 录制与媒体输出
// 演示 MDN：
//   1. Canvas 静态导出：canvas.toDataURL(type, quality) 返回 data: URL（base64），
//      type 支持 'image/png'(默认)/'image/jpeg'/'image/webp'，quality 0-1 仅 jpeg/webp；
//      canvas.toBlob(callback, type, quality) 异步返回 Blob（不进 base64 编码，内存友好）；
//      OffscreenCanvas.convertToBlob({ type, quality }) 返回 Promise<Blob>，Worker 可用；
//      三者对比：同步 vs 异步、内存占用、跨域污染（tainted canvas 抛 SecurityError）。
//      跨域：drawImage 跨域图片后 canvas 变 tainted，toBlob/toDataURL/captureStream 抛
//      SecurityError，需 img.crossOrigin = 'anonymous' + 服务端 CORS。
//   2. Canvas 实时流捕获：canvas.captureStream(frameRate) 返回 MediaStream，frameRate 可选
//      （不传=自动、30=30fps、0=手动）；返回流含一个 CanvasCaptureMediaStreamTrack；
//      track.requestFrame() 手动请求一帧；track.canvas 指向源 canvas；可用于 WebRTC 推流 /
//      MediaRecorder 录制 / <video> 实时显示。浏览器支持：Chrome 51+、Firefox 43+、Safari 14+。
//   3. MediaRecorder 录制 Canvas：new MediaRecorder(stream, { mimeType, videoBitsPerSecond,
//      audioBitsPerSecond })；mimeType：'video/webm'(默认)/'video/webm;codecs=vp9'/'vp8'/'video/mp4'(Safari)；
//      MediaRecorder.isTypeSupported(type) 静态检测；recorder.start(timeslice)（>0 定时产出 chunk，
//      =0 仅 stop 产出）；recorder.ondataavailable 收集 chunks；recorder.stop() → onstop 合并 Blob；
//      pause()/resume()/requestData()/state；输出 Blob → URL.createObjectURL → <video> 回放。
//   4. 完整录制流程：canvas → rAF 动画 → captureStream(30) → MediaRecorder → start → 录制 N 秒 →
//      stop → 合并 Blob → 回放；帧率控制（30fps vs requestFrame 手动）；码率控制（videoBitsPerSecond
//      影响画质与文件大小）；错误处理 onerror / SecurityError(tainted) / NotSupportedError(mime)；
//      内存管理：revokeObjectURL、stop track。
//   5. WebCodecs 替代方案：new VideoFrame(canvas, { timestamp }) 从 canvas 创建视频帧；
//      new VideoEncoder({ output, error }) 创建编码器；encoder.configure({ codec, width, height,
//      bitrate, framerate })；encoder.encode(frame, { keyFrame })；encoder.flush() 刷出编码数据；
//      优势：帧级控制、更低延迟、自定义容器、可接入 WebRTC；劣势：API 复杂、需手动封装
//      EncodedVideoChunk → 容器。浏览器支持：Chrome 94+。
//   6. 音频混合录制：new AudioContext() + createMediaStreamDestination() 创建音频目标节点；
//      canvas.captureStream() + audioDestination.stream 合并；new MediaStream([...videoTracks,
//      ...audioTracks]) 组合流；new MediaRecorder(combinedStream) 录制含音轨视频。场景：录制带
//      背景音乐的 canvas 动画、游戏画面+音效。
// 兼容性：jsdom 中 getContext 返回桩对象（fillRect/fillText 等空函数），但 captureStream / toBlob /
//   MediaRecorder / VideoEncoder / createMediaStreamDestination 可能未定义；所有调用前均做 typeof
//   能力检测，不可用时 _addLog('warn', ...)，绝不抛异常。MediaRecorder 在测试环境已 polyfill
//   （start/stop/ondataavailable），但不会产出真实数据，演示时记录流程即可。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// MediaRecorder 候选 mimeType 列表（Card 3 / 4 / 6 复用）
const RECORDER_MIME_TYPES = [
  'video/webm',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/mp4',
];

export class CanvasRecordingPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      // 共享事件日志（所有卡片写入同一面板，最多 40 条）
      logs: [],
      // 能力检测摘要（componentDidMount 中填充，渲染时非空才显示 Alert）
      capsSummary: '',
      // Card 1：静态导出结果摘要
      exportResult: '尚未导出',
      // Card 2：captureStream 信息
      captureInfo: '尚未捕获',
      // Card 3：MediaRecorder 状态与所选 mime
      recorderState: 'inactive',
      recorderMime: '',
      // Card 4：端到端录制状态与进度
      e2eState: 'idle',
      e2eProgress: '尚未录制',
      // Card 5：WebCodecs 信息
      codecsInfo: '尚未编码',
      // Card 6：音频混合录制状态与信息
      audioState: 'idle',
      audioInfo: '尚未录制',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★ 防御性初始化实例引用：仅在未定义时赋值，避免 rerender 触发的 componentDidMount
    //   重入把进行中的 recorder / stream / rAF 引用清空（_inited 守卫只防 caps 检测重入，
    //   但 setState → rerender → componentDidMount 会再次执行到此处，故引用须幂等保留）。
    if (this._animIds == null) this._animIds = {};
    // Card 2：captureStream
    if (this._capStream === undefined) this._capStream = null;
    if (this._capTrack === undefined) this._capTrack = null;
    // Card 3：MediaRecorder
    if (this._recStream === undefined) this._recStream = null;
    if (this._recTrack === undefined) this._recTrack = null;
    if (this._recorder === undefined) this._recorder = null;
    if (this._recChunks === undefined) this._recChunks = [];
    if (this._recUrl === undefined) this._recUrl = null;
    if (this._recMime === undefined) this._recMime = '';
    // Card 4：端到端
    if (this._e2eStream === undefined) this._e2eStream = null;
    if (this._e2eTrack === undefined) this._e2eTrack = null;
    if (this._e2eRecorder === undefined) this._e2eRecorder = null;
    if (this._e2eChunks === undefined) this._e2eChunks = [];
    if (this._e2eUrl === undefined) this._e2eUrl = null;
    if (this._e2eMime === undefined) this._e2eMime = '';
    if (this._e2eTimer === undefined) this._e2eTimer = null;
    if (this._e2eStopTimer === undefined) this._e2eStopTimer = null;
    if (this._e2eStart === undefined) this._e2eStart = 0;
    // Card 5：WebCodecs
    if (this._encoder === undefined) this._encoder = null;
    if (this._encodedChunks === undefined) this._encodedChunks = [];
    // Card 6：音频混合
    if (this._audioCtx === undefined) this._audioCtx = null;
    if (this._audioDest === undefined) this._audioDest = null;
    if (this._audioOsc === undefined) this._audioOsc = null;
    if (this._audioVideoStream === undefined) this._audioVideoStream = null;
    if (this._audioRecorder === undefined) this._audioRecorder = null;
    if (this._audioChunks === undefined) this._audioChunks = [];
    if (this._audioUrl === undefined) this._audioUrl = null;
    if (this._audioMime === undefined) this._audioMime = '';
    if (this._audioTimer === undefined) this._audioTimer = null;
    if (this._audioStopTimer === undefined) this._audioStopTimer = null;
    if (this._audioStart === undefined) this._audioStart = 0;

    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测（绝不抛异常，仅 typeof / in / prototype 判定）——
    const caps = this._caps();
    const summary =
      '能力检测：HTMLCanvasElement=' + (caps.canvas ? '✓' : '✗') +
      '，toDataURL=' + (caps.toDataURL ? '✓' : '✗') +
      '，toBlob=' + (caps.toBlob ? '✓' : '✗') +
      '，captureStream=' + (caps.captureStream ? '✓' : '✗') +
      '，requestFrame=' + (caps.requestFrame ? '✓' : '✗') +
      '，OffscreenCanvas=' + (caps.offscreen ? '✓' : '✗') +
      '，convertToBlob=' + (caps.convertToBlob ? '✓' : '✗') +
      '，MediaRecorder=' + (caps.mediaRecorder ? '✓' : '✗') +
      '，isTypeSupported=' + (caps.isTypeSupported ? '✓' : '✗') +
      '，VideoFrame=' + (caps.videoFrame ? '✓' : '✗') +
      '，VideoEncoder=' + (caps.videoEncoder ? '✓' : '✗') +
      '，AudioContext=' + (caps.audioContext ? '✓' : '✗') +
      '，createMediaStreamDestination=' + (caps.mediaStreamDest ? '✓' : '✗');
    this.setState({ capsSummary: summary });
    this._addLog('cap', summary);

    if (!caps.canvas) {
      this._addLog('warn', 'HTMLCanvasElement 不可用，所有 Canvas 演示将仅记日志');
    } else {
      if (!caps.toDataURL) this._addLog('warn', 'toDataURL 不可用或会抛 "Not implemented"（jsdom 限制），Card 1 将记录错误');
      if (!caps.toBlob) this._addLog('warn', 'toBlob 不可用（jsdom 限制），Card 1 toBlob 演示将跳过');
      if (!caps.offscreen || !caps.convertToBlob) this._addLog('warn', 'OffscreenCanvas/convertToBlob 不可用，Card 1 convertToBlob 将跳过');
      if (!caps.captureStream) this._addLog('warn', 'canvas.captureStream 不可用（jsdom 限制）；需 Chrome 51+/Firefox 43+/Safari 14+，Card 2/3/4/6 实时流演示将仅记流程');
      if (!caps.mediaRecorder) this._addLog('warn', 'MediaRecorder 不可用，Card 3/4/6 录制演示将仅记流程');
      if (!caps.isTypeSupported) this._addLog('warn', 'MediaRecorder.isTypeSupported 不可用（polyfill 限制），mime 检测将标记为未知');
      if (!caps.videoFrame || !caps.videoEncoder) this._addLog('warn', 'WebCodecs 不可用（VideoFrame/VideoEncoder）；需 Chrome 94+，Card 5 将仅记流程');
      if (!caps.audioContext || !caps.mediaStreamDest) this._addLog('warn', 'AudioContext/createMediaStreamDestination 不可用，Card 6 音频混合将仅记流程');
    }
  }

  componentWillUnmount() {
    // —— 停止所有 rAF 动画 ——
    try {
      if (this._animIds) {
        for (const id of Object.keys(this._animIds)) {
          if (this._animIds[id] != null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this._animIds[id]);
          }
        }
      }
      this._animIds = {};
    } catch { /* noop */ }

    // —— Card 2：captureStream ——
    this._stopTrack(this._capTrack); this._capTrack = null;
    this._stopStream(this._capStream); this._capStream = null;

    // —— Card 3：MediaRecorder ——
    this._safeStopRecorder(this._recorder);
    this._stopTrack(this._recTrack); this._recTrack = null;
    this._stopStream(this._recStream); this._recStream = null;
    this._revoke(this._recUrl); this._recUrl = null;

    // —— Card 4：端到端 ——
    try { if (this._e2eTimer) { clearInterval(this._e2eTimer); this._e2eTimer = null; } } catch { /* noop */ }
    try { if (this._e2eStopTimer) { clearTimeout(this._e2eStopTimer); this._e2eStopTimer = null; } } catch { /* noop */ }
    this._safeStopRecorder(this._e2eRecorder);
    this._stopTrack(this._e2eTrack); this._e2eTrack = null;
    this._stopStream(this._e2eStream); this._e2eStream = null;
    this._revoke(this._e2eUrl); this._e2eUrl = null;

    // —— Card 5：WebCodecs ——
    try { if (this._encoder && typeof this._encoder.close === 'function') this._encoder.close(); } catch { /* noop */ }
    this._encoder = null;

    // —— Card 6：音频混合 ——
    try { if (this._audioTimer) { clearInterval(this._audioTimer); this._audioTimer = null; } } catch { /* noop */ }
    try { if (this._audioStopTimer) { clearTimeout(this._audioStopTimer); this._audioStopTimer = null; } } catch { /* noop */ }
    try { if (this._audioOsc && typeof this._audioOsc.stop === 'function') this._audioOsc.stop(); } catch { /* noop */ }
    this._audioOsc = null;
    this._safeStopRecorder(this._audioRecorder);
    this._stopStream(this._audioVideoStream); this._audioVideoStream = null;
    try {
      if (this._audioDest && this._audioDest.stream && typeof this._audioDest.stream.getTracks === 'function') {
        this._audioDest.stream.getTracks().forEach((t) => this._stopTrack(t));
      }
    } catch { /* noop */ }
    this._audioDest = null;
    try { if (this._audioCtx && typeof this._audioCtx.close === 'function') this._audioCtx.close(); } catch { /* noop */ }
    this._audioCtx = null;
    this._revoke(this._audioUrl); this._audioUrl = null;
  }

  // —— 辅助：同步能力检测（render 时也调用，开销可忽略；结果幂等）——
  _caps() {
    const caps = {
      canvas: false, toDataURL: false, toBlob: false,
      captureStream: false, requestFrame: false,
      offscreen: false, convertToBlob: false,
      mediaRecorder: false, isTypeSupported: false,
      videoFrame: false, videoEncoder: false,
      audioContext: false, mediaStreamDest: false,
    };
    try {
      if (typeof HTMLCanvasElement === 'undefined' ||
        typeof document === 'undefined' ||
        typeof document.createElement !== 'function') {
        return caps;
      }
      const c = document.createElement('canvas');
      if (typeof c.getContext !== 'function') return caps;
      caps.canvas = true;
      const ctx = c.getContext('2d');
      if (!ctx) return caps;
      caps.toDataURL = typeof c.toDataURL === 'function';
      caps.toBlob = typeof c.toBlob === 'function';
      caps.captureStream = typeof HTMLCanvasElement.prototype.captureStream === 'function';
      // requestFrame 无法在没有真实 stream 的情况下探测，仅当 captureStream 可用时认为可用
      // （CanvasCaptureMediaStreamTrack.requestFrame 在所有支持 captureStream 的浏览器均存在）
      caps.requestFrame = caps.captureStream;
      caps.offscreen = typeof OffscreenCanvas !== 'undefined';
      if (caps.offscreen) {
        try { caps.convertToBlob = typeof OffscreenCanvas.prototype.convertToBlob === 'function'; } catch { /* noop */ }
      }
      caps.mediaRecorder = typeof MediaRecorder !== 'undefined';
      if (caps.mediaRecorder) {
        try { caps.isTypeSupported = typeof MediaRecorder.isTypeSupported === 'function'; } catch { /* noop */ }
      }
      caps.videoFrame = typeof VideoFrame !== 'undefined';
      caps.videoEncoder = typeof VideoEncoder !== 'undefined';
      const AC = typeof AudioContext !== 'undefined' ? AudioContext
        : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
      caps.audioContext = !!AC;
      if (AC) {
        try { caps.mediaStreamDest = typeof AC.prototype.createMediaStreamDestination === 'function'; } catch { /* noop */ }
      }
    } catch { /* jsdom 等环境访问可能抛错 */ }
    return caps;
  }

  // —— 辅助：通过 DOM id 获取 canvas 2D context（带能力检测）——
  // 通过 document.getElementById 获取 canvas，避免 rerender 后旧引用失效
  _getCtx(id) {
    try {
      if (typeof document === 'undefined' ||
        typeof document.getElementById !== 'function') {
        return null;
      }
      const canvas = document.getElementById(id);
      if (!canvas || typeof canvas.getContext !== 'function') return null;
      const ctx = canvas.getContext('2d');
      return ctx || null;
    } catch {
      return null;
    }
  }

  // —— 辅助：在 canvas 上绘制一帧动画（渐变背景 + 移动圆 + 旋转方块 + 时间文字）——
  _drawAnimFrame(ctx, w, h, t) {
    try {
      if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, w, h);
      if (typeof ctx.createLinearGradient === 'function') {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#1677ff');
        g.addColorStop(0.5, '#722ed1');
        g.addColorStop(1, '#ff4d4f');
        if ('fillStyle' in ctx) ctx.fillStyle = g;
      } else if ('fillStyle' in ctx) {
        ctx.fillStyle = '#1677ff';
      }
      if (typeof ctx.fillRect === 'function') ctx.fillRect(0, 0, w, h);
      // 移动的白色圆
      const cx = w / 2 + Math.cos(t * 2) * (w / 3);
      const cy = h / 2 + Math.sin(t * 2) * (h / 3);
      if (typeof ctx.beginPath === 'function') ctx.beginPath();
      if (typeof ctx.arc === 'function') ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      if ('fillStyle' in ctx) ctx.fillStyle = 'rgba(255,255,255,0.85)';
      if (typeof ctx.fill === 'function') ctx.fill();
      // 中心旋转方块
      if (typeof ctx.save === 'function') ctx.save();
      if (typeof ctx.translate === 'function') ctx.translate(w / 2, h / 2);
      if (typeof ctx.rotate === 'function') ctx.rotate(t);
      if ('fillStyle' in ctx) ctx.fillStyle = '#faad14';
      if (typeof ctx.fillRect === 'function') ctx.fillRect(-18, -18, 36, 36);
      if (typeof ctx.restore === 'function') ctx.restore();
      // 时间文字
      if (typeof ctx.fillText === 'function') {
        if ('font' in ctx) ctx.font = 'bold 14px sans-serif';
        if ('fillStyle' in ctx) ctx.fillStyle = '#fff';
        ctx.fillText(`t=${t.toFixed(1)}s`, 8, 22);
      }
    } catch { /* jsdom 桩函数可能抛错，忽略 */ }
  }

  // —— 辅助：绘制静态场景（渐变 + 三圆 + 文字），供 Card 1 / 5 复用 ——
  _drawStaticScene(ctx, w, h, label) {
    try {
      if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, w, h);
      if (typeof ctx.createLinearGradient === 'function') {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#1677ff');
        g.addColorStop(0.5, '#722ed1');
        g.addColorStop(1, '#ff4d4f');
        if ('fillStyle' in ctx) ctx.fillStyle = g;
      } else if ('fillStyle' in ctx) {
        ctx.fillStyle = '#722ed1';
      }
      if (typeof ctx.fillRect === 'function') ctx.fillRect(0, 0, w, h);
      const colors = ['#faad14', '#52c41a', '#ffffff'];
      for (let i = 0; i < 3; i++) {
        if (typeof ctx.beginPath === 'function') ctx.beginPath();
        if (typeof ctx.arc === 'function') ctx.arc(48 + i * 64, h / 2, 26, 0, Math.PI * 2);
        if ('fillStyle' in ctx) ctx.fillStyle = colors[i];
        if (typeof ctx.fill === 'function') ctx.fill();
      }
      if (typeof ctx.fillText === 'function') {
        if ('font' in ctx) ctx.font = 'bold 18px sans-serif';
        if ('fillStyle' in ctx) ctx.fillStyle = '#fff';
        ctx.fillText(label || 'CANVAS', 10, 24);
      }
    } catch { /* noop */ }
  }

  // —— 辅助：启动/停止 rAF 动画（按 canvas id 维护独立 rafId）——
  _startAnim(id) {
    const ctx = this._getCtx(id);
    if (!ctx) { this._addLog('warn', `${id} 元素不可用，无法启动动画`); return false; }
    const canvas = document.getElementById(id);
    const w = (canvas && canvas.width) || 320;
    const h = (canvas && canvas.height) || 200;
    this._stopAnim(id);  // 避免重复启动
    const start = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
    const tick = (now) => {
      const t = ((typeof now === 'number' ? now : Date.now()) - start) / 1000;
      this._drawAnimFrame(ctx, w, h, t);
      this._animIds[id] = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(tick) : null;
    };
    this._animIds[id] = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(tick) : null;
    return true;
  }

  _stopAnim(id) {
    try {
      if (this._animIds && this._animIds[id] != null) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._animIds[id]);
        this._animIds[id] = null;
      }
    } catch { /* noop */ }
  }

  // —— 辅助：安全停止 MediaStreamTrack / MediaStream / recorder / URL ——
  _stopTrack(track) {
    try { if (track && typeof track.stop === 'function') track.stop(); } catch { /* noop */ }
  }

  _stopStream(stream) {
    try {
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((t) => { try { if (typeof t.stop === 'function') t.stop(); } catch { /* noop */ } });
      }
    } catch { /* noop */ }
  }

  _safeStopRecorder(recorder) {
    try {
      if (recorder && recorder.state !== 'inactive' && typeof recorder.stop === 'function') {
        recorder.stop();
      }
    } catch { /* noop */ }
  }

  _revoke(url) {
    try { if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url); } catch { /* noop */ }
  }

  // —— 辅助：合并 chunks → Blob → URL.createObjectURL → 设置 <video> 回放 ——
  _buildPlaybackUrl(chunks, mime, videoId) {
    try {
      const type = (mime || 'video/webm').indexOf('mp4') >= 0 ? 'video/mp4' : 'video/webm';
      const blob = new Blob(chunks, { type });
      let url = '';
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        url = URL.createObjectURL(blob);
      }
      if (videoId && url) {
        const v = document.getElementById(videoId);
        if (v) v.src = url;
      }
      this._addLog('blob', `合并 ${chunks.length} chunks → Blob(${blob.size} bytes, ${blob.type}) → ${url ? 'URL 已生成' : 'URL.createObjectURL 不可用'}`);
      return { url, blob };
    } catch (err) {
      this._addLog('err', `合并 Blob 失败：${err.name} - ${err.message}`);
      return { url: '', blob: null };
    }
  }

  // —— 辅助：选择首个 isTypeSupported 的 mime，无检测能力时回退 'video/webm' ——
  _pickMime() {
    const caps = this._caps();
    if (!caps.isTypeSupported) return 'video/webm';
    for (const mt of RECORDER_MIME_TYPES) {
      try { if (MediaRecorder.isTypeSupported(mt)) return mt; } catch { /* noop */ }
    }
    return 'video/webm';
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type, content) {
    this.setState({
      logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40),
    });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // =================== Card 1: Canvas 静态导出 ===================

  _drawExportScene() {
    const ctx = this._getCtx('canvas-export');
    if (!ctx) { this._addLog('warn', 'canvas-export 元素不可用'); return; }
    const canvas = document.getElementById('canvas-export');
    const w = (canvas && canvas.width) || 320;
    const h = (canvas && canvas.height) || 200;
    this._drawStaticScene(ctx, w, h, 'EXPORT');
    this.setState({ exportResult: '已绘制静态场景（渐变 + 三圆 + 文字）' });
    this._addLog('export', '已绘制静态场景，可点击下方按钮导出为 data: URL / Blob');
  }

  _toDataURLDemo(type, quality) {
    const caps = this._caps();
    if (!caps.toDataURL) { this._addLog('warn', 'canvas.toDataURL 不可用（jsdom 限制）'); return; }
    const canvas = document.getElementById('canvas-export');
    if (!canvas) { this._addLog('warn', 'canvas-export 元素不可用'); return; }
    try {
      const url = (quality === undefined) ? canvas.toDataURL(type) : canvas.toDataURL(type, quality);
      const head = url.slice(0, 48);
      // base64 → 原始字节数近似（去掉 "data:...;base64," 前缀约 22 字符后 ×3/4）
      const approxBytes = Math.max(0, Math.ceil((url.length - 22) * 3 / 4));
      this._addLog('export', `toDataURL('${type}'${quality !== undefined ? `, ${quality}` : ''}) → ${url.length} 字符 (≈${approxBytes} bytes)`);
      this._addLog('blob', `data URL 头部：${head}...`);
      this.setState({ exportResult: `toDataURL ${type} → ≈${approxBytes} bytes` });
      if (type === 'image/jpeg' || type === 'image/webp') {
        this._addLog('export', `quality=${quality} 仅对 jpeg/webp 生效；png 为无损格式，quality 被忽略`);
      } else {
        this._addLog('export', `png 为默认无损格式，无 quality 参数概念`);
      }
    } catch (err) {
      this._addLog('err', `toDataURL 失败：${err.name} - ${err.message}`);
      if (err.name === 'SecurityError') {
        this._addLog('err', 'SecurityError：canvas 被 tainted（曾 drawImage 跨域图片），需 img.crossOrigin="anonymous" + 服务端 CORS');
      }
    }
  }

  _toBlobDemo(type, quality) {
    const caps = this._caps();
    if (!caps.toBlob) { this._addLog('warn', 'canvas.toBlob 不可用（jsdom 限制）；真实浏览器异步返回 Blob，比 toDataURL 内存友好'); return; }
    const canvas = document.getElementById('canvas-export');
    if (!canvas) { this._addLog('warn', 'canvas-export 元素不可用'); return; }
    this._addLog('export', `toBlob(callback, '${type}'${quality !== undefined ? `, ${quality}` : ''}) 异步调用...`);
    try {
      canvas.toBlob((blob) => {
        if (!blob) { this._addLog('warn', 'toBlob 回调收到 null'); return; }
        this._addLog('blob', `toBlob 回调：Blob { size=${blob.size}, type="${blob.type}" }（不经 base64，内存友好）`);
        this.setState({ exportResult: `toBlob ${type} → ${blob.size} bytes` });
      }, type, quality);
    } catch (err) {
      this._addLog('err', `toBlob 失败：${err.name} - ${err.message}`);
      if (err.name === 'SecurityError') {
        this._addLog('err', 'SecurityError：canvas 被 tainted，toBlob 同样受跨域污染限制');
      }
    }
  }

  _convertToBlobDemo(type, quality) {
    const caps = this._caps();
    if (!caps.offscreen || !caps.convertToBlob) {
      this._addLog('warn', `OffscreenCanvas/convertToBlob 不可用（offscreen=${caps.offscreen}, convertToBlob=${caps.convertToBlob}）`);
      return;
    }
    try {
      const off = new OffscreenCanvas(160, 100);
      const octx = off.getContext('2d');
      if (octx) this._drawStaticScene(octx, 160, 100, 'OFFSCREEN');
      this._addLog('offscreen', `OffscreenCanvas(160,100) 绘制后 convertToBlob({ type:'${type}', quality:${quality} })...`);
      const p = off.convertToBlob({ type, quality });
      if (p && typeof p.then === 'function') {
        p.then((blob) => {
          this._addLog('offscreen', `convertToBlob 完成：Blob { size=${blob.size}, type="${blob.type}" }（返回 Promise，Worker 可用）`);
          this.setState({ exportResult: `convertToBlob ${type} → ${blob.size} bytes` });
        }).catch((err) => this._addLog('err', `convertToBlob 失败：${err.name} - ${err.message}`));
      } else {
        this._addLog('warn', 'convertToBlob 未返回 Promise（环境限制）');
      }
    } catch (err) {
      this._addLog('err', `OffscreenCanvas 失败：${err.name} - ${err.message}`);
    }
  }

  _explainTainted() {
    this._addLog('warn', '跨域污染（tainted canvas）：drawImage 加载跨域图片后，canvas 被标记为 tainted');
    this._addLog('warn', '此后 toBlob / toDataURL / captureStream 抛 SecurityError；getImageData 亦被禁用');
    this._addLog('info', '解决方案：img.crossOrigin = "anonymous" + 服务端响应 Access-Control-Allow-Origin');
    this._addLog('export', '对比：toDataURL 同步返回 base64（内存 ×1.33）；toBlob 异步返回二进制（更省内存）；convertToBlob Promise + Worker 友好');
  }

  // =================== Card 2: Canvas 实时流捕获 captureStream ===================

  _startCapture(fps) {
    const caps = this._caps();
    if (!caps.captureStream) {
      this._addLog('warn', 'canvas.captureStream 不可用（jsdom 限制）；需 Chrome 51+/Firefox 43+/Safari 14+');
      this._addLog('capture', '检测方式：typeof HTMLCanvasElement.prototype.captureStream === "function"');
      return;
    }
    const ctx = this._getCtx('canvas-capture');
    if (!ctx) { this._addLog('warn', 'canvas-capture 元素不可用'); return; }
    const canvas = document.getElementById('canvas-capture');
    this._stopCapture(true);  // 先清理上一次
    this._startAnim('canvas-capture');
    let stream;
    try {
      stream = (fps === undefined) ? canvas.captureStream() : canvas.captureStream(fps);
    } catch (err) {
      this._addLog('err', `captureStream 失败：${err.name} - ${err.message}`);
      this._stopAnim('canvas-capture');
      return;
    }
    this._capStream = stream;
    const tracks = (typeof stream.getTracks === 'function') ? stream.getTracks() : [];
    this._capTrack = tracks[0] || null;
    const label = fps === undefined ? 'auto(不传)' : String(fps);
    this._addLog('capture', `canvas.captureStream(${label}) → MediaStream(${tracks.length} 轨)`);
    if (this._capTrack) {
      this._addLog('capture', `track.kind=${this._capTrack.kind}, label="${this._capTrack.label || 'canvas'}", readyState=${this._capTrack.readyState}`);
      if ('canvas' in this._capTrack) {
        this._addLog('capture', 'track.canvas 指向源 canvas（CanvasCaptureMediaStreamTrack 专属属性）');
      }
      if (typeof this._capTrack.requestFrame === 'function') {
        this._addLog('capture', 'track.requestFrame() 可用（frameRate=0 手动模式时由此推送帧）');
      } else {
        this._addLog('warn', 'track.requestFrame 不可用（当前环境限制）');
      }
    }
    this._addLog('capture', '实战：该 MediaStream 可用于 WebRTC 推流 / MediaRecorder 录制 / <video> 实时显示');
    this.setState({ captureInfo: `captureStream(${label}) 已启动，${tracks.length} 轨` });
  }

  _stopCapture(silent) {
    this._stopTrack(this._capTrack); this._capTrack = null;
    this._stopStream(this._capStream); this._capStream = null;
    this._stopAnim('canvas-capture');
    if (!silent) this._addLog('capture', '已停止捕获：track.stop() + 取消 rAF 动画');
    this.setState({ captureInfo: '已停止' });
  }

  _requestManualFrame() {
    if (!this._capTrack) { this._addLog('warn', '请先点击「captureStream(0) 手动」启动手动模式'); return; }
    if (typeof this._capTrack.requestFrame !== 'function') { this._addLog('warn', 'track.requestFrame 不可用（环境限制）'); return; }
    try {
      this._capTrack.requestFrame();
      this._addLog('capture', 'track.requestFrame() 已手动推送一帧（frameRate=0 模式下逐帧控制）');
    } catch (err) {
      this._addLog('err', `requestFrame 失败：${err.name} - ${err.message}`);
    }
  }

  // =================== Card 3: MediaRecorder 录制 Canvas ===================

  _checkMimeSupport() {
    const caps = this._caps();
    if (!caps.mediaRecorder) { this._addLog('warn', 'MediaRecorder 不可用，无法检测 mimeType'); return; }
    this._addLog('mime', `MediaRecorder.isTypeSupported ${caps.isTypeSupported ? '可用' : '不可用（polyfill 限制，结果标记为未知）'}`);
    for (const mt of RECORDER_MIME_TYPES) {
      let supported = false;
      if (caps.isTypeSupported) {
        try { supported = MediaRecorder.isTypeSupported(mt); } catch { /* noop */ }
      }
      this._addLog('mime', `${mt} → ${supported ? '✓ 支持' : '✗ 不支持/未知'}`);
    }
    this._addLog('mime', '注：webm 系列为 Chrome/Firefox 默认；mp4 仅 Safari 较新版本支持');
  }

  _startRecorder(mime, timeslice) {
    const caps = this._caps();
    if (!caps.mediaRecorder) { this._addLog('warn', 'MediaRecorder 不可用'); return; }
    if (!caps.captureStream) { this._addLog('warn', 'canvas.captureStream 不可用，无法录制'); return; }
    const ctx = this._getCtx('canvas-recorder');
    if (!ctx) { this._addLog('warn', 'canvas-recorder 元素不可用'); return; }
    const canvas = document.getElementById('canvas-recorder');
    // 清理上一次录制
    if (this._recorder && this._recorder.state !== 'inactive') {
      this._safeStopRecorder(this._recorder);
    }
    this._stopAnim('canvas-recorder');
    this._startAnim('canvas-recorder');
    let stream;
    try { stream = canvas.captureStream(30); }
    catch (err) {
      this._addLog('err', `captureStream 失败：${err.name} - ${err.message}`);
      this._stopAnim('canvas-recorder');
      return;
    }
    this._recStream = stream;
    this._recTrack = (typeof stream.getTracks === 'function') ? stream.getTracks()[0] : null;
    const chosenMime = mime || this._pickMime();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: chosenMime, videoBitsPerSecond: 2_500_000 });
    } catch (err) {
      this._addLog('warn', `MediaRecorder({ mimeType: "${chosenMime}" }) 失败：${err.name}，尝试默认 mime`);
      try { recorder = new MediaRecorder(stream); }
      catch (err2) {
        this._addLog('err', `MediaRecorder 构造失败：${err2.name} - ${err2.message}`);
        this._stopAnim('canvas-recorder');
        return;
      }
    }
    this._recorder = recorder;
    this._recMime = chosenMime;
    this._recChunks = [];
    recorder.ondataavailable = (e) => {
      if (e && e.data && e.data.size > 0) {
        this._recChunks.push(e.data);
        this._addLog('rec', `ondataavailable: chunk ${e.data.size} bytes（累计 ${this._recChunks.length}）`);
      }
    };
    recorder.onstop = () => {
      this._revoke(this._recUrl);
      const { url, blob } = this._buildPlaybackUrl(this._recChunks, chosenMime, 'video-recorder');
      this._recUrl = url;
      if (blob) this._addLog('rec', `onstop：录制结束，可点击下方 <video> 回放`);
      this.setState({ recorderState: recorder.state || 'inactive' });
    };
    recorder.onerror = (e) => {
      const name = (e && e.error && e.error.name) || 'unknown';
      this._addLog('err', `recorder.onerror: ${name}`);
    };
    try {
      if (timeslice && timeslice > 0) recorder.start(timeslice);
      else recorder.start();
    } catch (err) {
      this._addLog('err', `recorder.start 失败：${err.name} - ${err.message}`);
      this._stopAnim('canvas-recorder');
      return;
    }
    this.setState({ recorderState: recorder.state, recorderMime: chosenMime });
    this._addLog('rec', `MediaRecorder.start(${timeslice || 0}) mime=${chosenMime} bitrate=2.5Mbps state=${recorder.state}`);
    if (timeslice && timeslice > 0) {
      this._addLog('rec', `timeslice=${timeslice}ms：每 ${timeslice}ms 产出一次 dataavailable chunk`);
    } else {
      this._addLog('rec', `timeslice=0：仅在 stop() 时一次性产出全部数据`);
    }
  }

  _pauseRecorder() {
    if (!this._recorder) { this._addLog('warn', '尚未开始录制'); return; }
    if (typeof this._recorder.pause !== 'function') { this._addLog('warn', 'recorder.pause 不可用（polyfill 限制）'); return; }
    try {
      this._recorder.pause();
      this.setState({ recorderState: this._recorder.state });
      this._addLog('rec', `pause() → state=${this._recorder.state}`);
    } catch (err) {
      this._addLog('err', `pause 失败：${err.name} - ${err.message}`);
    }
  }

  _resumeRecorder() {
    if (!this._recorder) { this._addLog('warn', '尚未开始录制'); return; }
    if (typeof this._recorder.resume !== 'function') { this._addLog('warn', 'recorder.resume 不可用（polyfill 限制）'); return; }
    try {
      this._recorder.resume();
      this.setState({ recorderState: this._recorder.state });
      this._addLog('rec', `resume() → state=${this._recorder.state}`);
    } catch (err) {
      this._addLog('err', `resume 失败：${err.name} - ${err.message}`);
    }
  }

  _requestData() {
    if (!this._recorder) { this._addLog('warn', '尚未开始录制'); return; }
    if (typeof this._recorder.requestData !== 'function') { this._addLog('warn', 'recorder.requestData 不可用（polyfill 限制）'); return; }
    try {
      this._recorder.requestData();
      this._addLog('rec', `requestData() 已手动触发 dataavailable（不等 timeslice）`);
    } catch (err) {
      this._addLog('err', `requestData 失败：${err.name} - ${err.message}`);
    }
  }

  _stopRecorder() {
    if (!this._recorder) { this._addLog('warn', '尚未开始录制'); return; }
    if (this._recorder.state === 'inactive') { this._addLog('warn', 'recorder 已 inactive'); return; }
    try {
      this._recorder.stop();
    } catch (err) {
      this._addLog('err', `stop 失败：${err.name} - ${err.message}`);
    }
    this._stopTrack(this._recTrack); this._recTrack = null;
    this._stopStream(this._recStream); this._recStream = null;
    this._stopAnim('canvas-recorder');
    this._addLog('rec', `stop() 调用，state=${this._recorder.state}，${this._recChunks.length} chunks 待 onstop 合并`);
    this.setState({ recorderState: this._recorder.state || 'inactive' });
  }

  // =================== Card 4: 完整录制流程实战 ===================

  _runE2E(seconds = 3) {
    const caps = this._caps();
    if (!caps.mediaRecorder || !caps.captureStream) {
      this._addLog('warn', `MediaRecorder(${caps.mediaRecorder}) / captureStream(${caps.captureStream}) 不可用，无法完整录制`);
      return;
    }
    const ctx = this._getCtx('canvas-e2e');
    if (!ctx) { this._addLog('warn', 'canvas-e2e 元素不可用'); return; }
    const canvas = document.getElementById('canvas-e2e');
    this._stopE2E(true);  // 清理上一次
    this._startAnim('canvas-e2e');
    let stream;
    try { stream = canvas.captureStream(30); }
    catch (err) {
      this._addLog('err', `captureStream 失败：${err.name} - ${err.message}`);
      this._stopAnim('canvas-e2e');
      return;
    }
    this._e2eStream = stream;
    this._e2eTrack = (typeof stream.getTracks === 'function') ? stream.getTracks()[0] : null;
    const mime = this._pickMime();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    } catch (err) {
      this._addLog('warn', `MediaRecorder({ mimeType: "${mime}" }) 失败：${err.name}，尝试默认 mime`);
      try { recorder = new MediaRecorder(stream, { videoBitsPerSecond: 2_500_000 }); }
      catch (e2) {
        this._addLog('err', `MediaRecorder 构造失败：${e2.name} - ${e2.message}`);
        this._stopAnim('canvas-e2e');
        return;
      }
    }
    this._e2eRecorder = recorder;
    this._e2eMime = mime;
    this._e2eChunks = [];
    recorder.ondataavailable = (e) => { if (e && e.data && e.data.size > 0) this._e2eChunks.push(e.data); };
    recorder.onstop = () => {
      this._revoke(this._e2eUrl);
      const { url, blob } = this._buildPlaybackUrl(this._e2eChunks, mime, 'video-e2e');
      this._e2eUrl = url;
      if (blob) {
        this._addLog('e2e', `onstop：录制完成 ${blob.size} bytes (${(blob.size / 1024).toFixed(1)} KB)，时长约 ${seconds}s，码率 2.5Mbps`);
        this._addLog('e2e', `内存管理：已 revoke 旧 URL、stop track；回放 <video> 已就绪`);
      }
      this.setState({ e2eState: 'done', e2eProgress: blob ? `完成 ${(blob.size / 1024).toFixed(1)} KB` : '已停止' });
    };
    recorder.onerror = (e) => {
      const name = (e && e.error && e.error.name) || 'unknown';
      this._addLog('err', `e2e recorder.onerror: ${name}`);
      if (name === 'SecurityError') {
        this._addLog('err', 'SecurityError：canvas 已被跨域图片污染（tainted），需 img.crossOrigin + CORS');
      } else if (name === 'NotSupportedError') {
        this._addLog('err', `NotSupportedError：mimeType "${mime}" 不支持，换用 _pickMime() 检测结果`);
      }
    };
    try { recorder.start(); }
    catch (err) {
      this._addLog('err', `start 失败：${err.name} - ${err.message}`);
      this._stopAnim('canvas-e2e');
      return;
    }
    this._e2eStart = Date.now();
    this.setState({ e2eState: 'recording', e2eProgress: `录制中... 0/${seconds}s` });
    this._addLog('e2e', `完整流程启动：canvas(rAF 动画) → captureStream(30) → MediaRecorder(${mime}, 2.5Mbps) → start()`);
    this._addLog('e2e', `帧率=30fps，码率=2.5Mbps，计划录制 ${seconds}s 后自动 stop`);
    this._addLog('e2e', `帧率控制：captureStream(30) 30fps vs captureStream(0)+requestFrame() 手动逐帧`);
    this._e2eTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this._e2eStart) / 1000);
      this.setState({ e2eProgress: `录制中... ${elapsed}/${seconds}s` });
    }, 500);
    this._e2eStopTimer = setTimeout(() => this._stopE2E(), seconds * 1000);
  }

  _stopE2E(silent) {
    if (this._e2eTimer) { try { clearInterval(this._e2eTimer); } catch { /* noop */ } this._e2eTimer = null; }
    if (this._e2eStopTimer) { try { clearTimeout(this._e2eStopTimer); } catch { /* noop */ } this._e2eStopTimer = null; }
    this._safeStopRecorder(this._e2eRecorder);
    this._stopTrack(this._e2eTrack); this._e2eTrack = null;
    this._stopStream(this._e2eStream); this._e2eStream = null;
    this._stopAnim('canvas-e2e');
    if (!silent) {
      this._addLog('e2e', `已停止：recorder.stop / track.stop / stream.stop / rAF 取消，${this._e2eChunks.length} chunks 待 onstop 合并`);
      this.setState({ e2eState: 'inactive' });
    }
  }

  // =================== Card 5: WebCodecs 替代方案 ===================

  _runWebCodecs() {
    const caps = this._caps();
    if (!caps.videoFrame || !caps.videoEncoder) {
      this._addLog('warn', `WebCodecs 不可用（VideoFrame=${caps.videoFrame}, VideoEncoder=${caps.videoEncoder}）；需 Chrome 94+`);
      this._addLog('codecs', '检测方式：typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined"');
      this._addLog('codecs', 'WebCodecs vs MediaRecorder：WebCodecs 提供帧级控制（VideoFrame + VideoEncoder），MediaRecorder 是黑盒');
      return;
    }
    const ctx = this._getCtx('canvas-codecs');
    if (!ctx) { this._addLog('warn', 'canvas-codecs 元素不可用'); return; }
    const canvas = document.getElementById('canvas-codecs');
    const w = (canvas && canvas.width) || 320;
    const h = (canvas && canvas.height) || 200;
    this._drawStaticScene(ctx, w, h, 'CODECS');
    this._encodedChunks = [];
    try {
      const encoder = new VideoEncoder({
        output: (chunk) => {
          this._encodedChunks.push(chunk);
          const ct = (chunk && chunk.type) || '?';
          const cs = (chunk && typeof chunk.byteLength === 'number') ? chunk.byteLength : '?';
          this._addLog('codecs', `EncodedVideoChunk #${this._encodedChunks.length} type=${ct} size=${cs}`);
        },
        error: (e) => this._addLog('err', `VideoEncoder error: ${(e && e.message) || e}`),
      });
      this._encoder = encoder;
      encoder.configure({
        codec: 'vp09.00.10.08',
        width: w, height: h,
        bitrate: 2_500_000,
        framerate: 30,
      });
      this._addLog('codecs', `VideoEncoder.configure({ codec:'vp09.00.10.08', ${w}x${h}, bitrate:2.5Mbps, framerate:30 })`);
      const frameCount = 10;
      for (let i = 0; i < frameCount; i++) {
        // 每帧轻微改变画面（移动文字位置），制造帧间差异
        if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, w, h);
        this._drawStaticScene(ctx, w, h, `FRAME ${i}`);
        const ts = Math.round(i * 1_000_000 / 30);  // 微秒
        const frame = new VideoFrame(canvas, { timestamp: ts });
        try {
          encoder.encode(frame, { keyFrame: i % 30 === 0 });
          this._addLog('codecs', `VideoFrame #${i} timestamp=${ts}μs → encode(${i % 30 === 0 ? 'keyFrame' : 'delta'})`);
        } catch (err) {
          this._addLog('err', `encode #${i} 失败：${err.name} - ${err.message}`);
        }
        try { if (typeof frame.close === 'function') frame.close(); } catch { /* noop */ }
      }
      this._addLog('codecs', `已 encode ${frameCount} 帧，调用 flush() 刷出剩余编码数据...`);
      const flushP = encoder.flush();
      if (flushP && typeof flushP.then === 'function') {
        flushP.then(() => {
          this._addLog('codecs', `flush() 完成，共 ${this._encodedChunks.length} 个 EncodedVideoChunk`);
          this._addLog('codecs', '注：EncodedVideoChunk 需自行封装为 webm/mp4 容器（如 mp4-muxer / webm-muxer 库）');
          this._addLog('codecs', '优势：精确帧控制、更低延迟、可自定义容器、可接入 WebRTC；劣势：API 复杂');
          this.setState({ codecsInfo: `编码 ${frameCount} 帧 → ${this._encodedChunks.length} chunks` });
        }).catch((e) => this._addLog('err', `flush 失败：${(e && e.message) || e}`));
      } else {
        this.setState({ codecsInfo: `编码 ${frameCount} 帧` });
      }
    } catch (err) {
      this._addLog('err', `WebCodecs 失败：${err.name} - ${err.message}`);
    }
  }

  // =================== Card 6: 音频混合录制 ===================

  _runAudioRecording(seconds = 3) {
    const caps = this._caps();
    if (!caps.mediaRecorder) { this._addLog('warn', 'MediaRecorder 不可用'); return; }
    if (!caps.captureStream) { this._addLog('warn', 'canvas.captureStream 不可用'); return; }
    if (!caps.audioContext || !caps.mediaStreamDest) {
      this._addLog('warn', `AudioContext/createMediaStreamDestination 不可用（AudioContext=${caps.audioContext}, dest=${caps.mediaStreamDest}）`);
      return;
    }
    const ctx = this._getCtx('canvas-audio');
    if (!ctx) { this._addLog('warn', 'canvas-audio 元素不可用'); return; }
    const canvas = document.getElementById('canvas-audio');
    this._stopAudioRecording(true);  // 清理上一次
    this._startAnim('canvas-audio');
    // 视频流
    let videoStream;
    try { videoStream = canvas.captureStream(30); }
    catch (err) {
      this._addLog('err', `captureStream 失败：${err.name} - ${err.message}`);
      this._stopAnim('canvas-audio');
      return;
    }
    this._audioVideoStream = videoStream;
    // 音频图：AudioContext + MediaStreamDestination + Oscillator + Gain
    let audioCtx, dest, osc, gain;
    try {
      const AC = typeof AudioContext !== 'undefined' ? AudioContext : webkitAudioContext;
      audioCtx = new AC();
      dest = audioCtx.createMediaStreamDestination();
      osc = audioCtx.createOscillator();
      gain = audioCtx.createGain();
      if ('type' in osc) osc.type = 'sine';
      if (osc.frequency) osc.frequency.value = 440;
      if (gain.gain) gain.gain.value = 0.1;
      if (typeof osc.connect === 'function') osc.connect(gain);
      if (typeof gain.connect === 'function') gain.connect(dest);
      // 同时连接到扬声器（destination）便于实时监听
      if (typeof gain.connect === 'function') gain.connect(audioCtx.destination);
      if (typeof osc.start === 'function') osc.start();
    } catch (err) {
      this._addLog('err', `音频图构建失败：${err.name} - ${err.message}`);
      this._stopAnim('canvas-audio');
      this._stopStream(videoStream); this._audioVideoStream = null;
      return;
    }
    this._audioCtx = audioCtx; this._audioDest = dest; this._audioOsc = osc;
    // 合并视频轨 + 音频轨
    const videoTracks = (typeof videoStream.getTracks === 'function') ? videoStream.getTracks() : [];
    const audioTracks = (dest.stream && typeof dest.stream.getTracks === 'function') ? dest.stream.getTracks() : [];
    let combined;
    if (typeof MediaStream !== 'undefined') {
      try {
        combined = new MediaStream([...videoTracks, ...audioTracks]);
      } catch (err) {
        this._addLog('warn', `MediaStream 合并失败，回退视频流：${err.name}`);
        combined = videoStream;
      }
    } else {
      this._addLog('warn', 'MediaStream 构造器不可用，回退视频流');
      combined = videoStream;
    }
    this._addLog('audio', `合并流：视频 ${videoTracks.length} 轨 + 音频 ${audioTracks.length} 轨 = ${combined.getTracks().length} 轨`);
    this._addLog('audio', `new AudioContext() + createMediaStreamDestination() + Oscillator(440Hz) + Gain(0.1)`);
    const mime = this._pickMime();
    let recorder;
    try {
      recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    } catch (err) {
      this._addLog('warn', `MediaRecorder({ mimeType: "${mime}" }) 失败：${err.name}，尝试默认 mime`);
      try { recorder = new MediaRecorder(combined); }
      catch (e2) {
        this._addLog('err', `MediaRecorder 构造失败：${e2.name} - ${e2.message}`);
        this._stopAnim('canvas-audio');
        return;
      }
    }
    this._audioRecorder = recorder;
    this._audioMime = mime;
    this._audioChunks = [];
    recorder.ondataavailable = (e) => { if (e && e.data && e.data.size > 0) this._audioChunks.push(e.data); };
    recorder.onstop = () => {
      this._revoke(this._audioUrl);
      const { url, blob } = this._buildPlaybackUrl(this._audioChunks, mime, 'video-audio');
      this._audioUrl = url;
      if (blob) this._addLog('audio', `onstop：含音轨录制完成 ${blob.size} bytes (${(blob.size / 1024).toFixed(1)} KB)`);
      this.setState({ audioState: 'done', audioInfo: blob ? `完成 ${(blob.size / 1024).toFixed(1)} KB` : '已停止' });
    };
    recorder.onerror = (e) => {
      const name = (e && e.error && e.error.name) || 'unknown';
      this._addLog('err', `audio recorder.onerror: ${name}`);
    };
    try { recorder.start(); }
    catch (err) {
      this._addLog('err', `start 失败：${err.name} - ${err.message}`);
      this._stopAnim('canvas-audio');
      return;
    }
    this._audioStart = Date.now();
    this.setState({ audioState: 'recording', audioInfo: `录制中... 0/${seconds}s` });
    this._addLog('audio', `开始录制：canvas(30fps) + 440Hz 正弦波 → MediaRecorder(${mime}, 2.5Mbps)，${seconds}s 后自动停止`);
    this._addLog('audio', '场景：录制带背景音乐的 canvas 动画、游戏画面 + 音效');
    this._audioTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this._audioStart) / 1000);
      this.setState({ audioInfo: `录制中... ${elapsed}/${seconds}s` });
    }, 500);
    this._audioStopTimer = setTimeout(() => this._stopAudioRecording(), seconds * 1000);
  }

  _stopAudioRecording(silent) {
    if (this._audioTimer) { try { clearInterval(this._audioTimer); } catch { /* noop */ } this._audioTimer = null; }
    if (this._audioStopTimer) { try { clearTimeout(this._audioStopTimer); } catch { /* noop */ } this._audioStopTimer = null; }
    try { if (this._audioOsc && typeof this._audioOsc.stop === 'function') this._audioOsc.stop(); } catch { /* noop */ }
    this._audioOsc = null;
    this._safeStopRecorder(this._audioRecorder);
    this._stopStream(this._audioVideoStream); this._audioVideoStream = null;
    try {
      if (this._audioDest && this._audioDest.stream && typeof this._audioDest.stream.getTracks === 'function') {
        this._audioDest.stream.getTracks().forEach((t) => this._stopTrack(t));
      }
    } catch { /* noop */ }
    this._audioDest = null;
    try { if (this._audioCtx && typeof this._audioCtx.close === 'function') this._audioCtx.close(); } catch { /* noop */ }
    this._audioCtx = null;
    this._stopAnim('canvas-audio');
    if (!silent && this.state.audioState === 'recording') {
      this._addLog('audio', '已停止：osc.stop / recorder.stop / 音轨 stop / AudioContext.close / rAF 取消');
      this.setState({ audioState: 'inactive' });
    }
  }

  // =================== 渲染 ===================

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Canvas 静态导出（Static Export）',
      desc: 'canvas.toDataURL(type, quality) → data: URL（base64）；canvas.toBlob(callback, type, quality) 异步返回 Blob；OffscreenCanvas.convertToBlob({ type, quality }) → Promise<Blob>。type: image/png(默认)/image/jpeg/image/webp；quality 0-1 仅 jpeg/webp。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.toDataURL ? 'success' : 'warning' }, caps.toDataURL ? 'toDataURL ✓' : 'toDataURL ✗'),
        h(Tag, { color: caps.toBlob ? 'success' : 'warning' }, caps.toBlob ? 'toBlob ✓' : 'toBlob ✗'),
        h(Tag, { color: caps.convertToBlob ? 'success' : 'warning' }, caps.convertToBlob ? 'convertToBlob ✓' : 'convertToBlob ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：先绘制静态场景，再分别用 toDataURL（同步 base64）/ toBlob（异步二进制）/ OffscreenCanvas.convertToBlob（Promise，Worker 友好）导出。toDataURL 内存占用约为原始数据 1.33 倍（base64 编码）；toBlob 不进 base64 更省内存；convertToBlob 可在 Worker 中运行。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('绘制静态场景', { type: 'primary', size: 'sm', onClick: () => this._drawExportScene() }),
          this._btn('toDataURL PNG', { size: 'sm', disabled: !caps.toDataURL, onClick: () => this._toDataURLDemo('image/png') }),
          this._btn('toDataURL JPEG q=0.5', { size: 'sm', disabled: !caps.toDataURL, onClick: () => this._toDataURLDemo('image/jpeg', 0.5) }),
          this._btn('toDataURL WebP q=0.8', { size: 'sm', disabled: !caps.toDataURL, onClick: () => this._toDataURLDemo('image/webp', 0.8) }),
          this._btn('toBlob PNG', { size: 'sm', disabled: !caps.toBlob, onClick: () => this._toBlobDemo('image/png') }),
          this._btn('toBlob WebP q=0.8', { size: 'sm', disabled: !caps.toBlob, onClick: () => this._toBlobDemo('image/webp', 0.8) }),
          this._btn('OffscreenCanvas convertToBlob', { size: 'sm', disabled: !caps.offscreen || !caps.convertToBlob, onClick: () => this._convertToBlobDemo('image/png') }),
          this._btn('跨域污染说明', { size: 'sm', onClick: () => this._explainTainted() }),
        ),
        h('canvas', {
          id: 'canvas-export', class: 'canvas-stage',
          width: 320, height: 200,
          style: { width: '320px', height: '200px', background: '#fff' },
        }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, `导出结果：${s.exportResult || '—'}`),
        h(Alert, {
          type: 'info',
          message: 'toDataURL vs toBlob vs convertToBlob',
          description: 'toDataURL 同步返回 base64 data URL（内存 ×1.33）；toBlob 异步回调返回二进制 Blob（更省内存）；convertToBlob 返回 Promise 且可在 Worker 中调用。三者均受 tainted canvas 限制：drawImage 跨域图片后会抛 SecurityError，需 img.crossOrigin="anonymous" + 服务端 CORS。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Canvas 实时流捕获（captureStream）',
      desc: 'canvas.captureStream(frameRate) → MediaStream，frameRate 可选（不传=自动、30=30fps、0=手动）；流含一个 CanvasCaptureMediaStreamTrack；track.requestFrame() 手动请求一帧；track.canvas 指向源 canvas。浏览器支持：Chrome 51+/Firefox 43+/Safari 14+。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.captureStream ? 'success' : 'warning' }, caps.captureStream ? 'captureStream ✓' : 'captureStream ✗'),
        h(Tag, { color: caps.requestFrame ? 'success' : 'warning' }, caps.requestFrame ? 'requestFrame ✓' : 'requestFrame ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：启动 rAF 动画后调用 captureStream，把 canvas 动画作为媒体源。frameRate=0 时需手动 requestFrame() 推送每一帧；不传或 >0 时浏览器按帧率自动捕获。该 MediaStream 可用于 WebRTC 推流、MediaRecorder 录制、<video> 实时显示。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('captureStream(30)', { type: 'primary', size: 'sm', disabled: !caps.captureStream, onClick: () => this._startCapture(30) }),
          this._btn('captureStream() 自动', { size: 'sm', disabled: !caps.captureStream, onClick: () => this._startCapture(undefined) }),
          this._btn('captureStream(0) 手动', { size: 'sm', disabled: !caps.captureStream, onClick: () => this._startCapture(0) }),
          this._btn('requestFrame()', { size: 'sm', disabled: !caps.requestFrame, onClick: () => this._requestManualFrame() }),
          this._btn('停止捕获', { size: 'sm', onClick: () => this._stopCapture(false) }),
        ),
        h('canvas', {
          id: 'canvas-capture', class: 'canvas-stage',
          width: 320, height: 200,
          style: { width: '320px', height: '200px', background: '#fff' },
        }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, `捕获信息：${s.captureInfo || '—'}`),
        h(Alert, {
          type: 'info',
          message: 'CanvasCaptureMediaStreamTrack',
          description: 'captureStream 返回的 MediaStream 仅含一条视频轨，类型为 CanvasCaptureMediaStreamTrack（MediaStreamTrack 子类）。track.canvas 反向指向源 canvas；track.requestFrame() 在 frameRate=0 手动模式下逐帧推送。检测：typeof HTMLCanvasElement.prototype.captureStream === "function"。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const recDisabled = !caps.mediaRecorder || !caps.captureStream;
    const card = new Card({
      title: '3. MediaRecorder 录制 Canvas（Recording Canvas）',
      desc: 'new MediaRecorder(stream, { mimeType, videoBitsPerSecond, audioBitsPerSecond })；MediaRecorder.isTypeSupported(type) 静态检测；recorder.start(timeslice)（>0 定时产出 chunk，=0 仅 stop 产出）；ondataavailable 收集 chunks；stop() → onstop 合并 Blob；pause/resume/requestData/state。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.mediaRecorder ? 'success' : 'warning' }, caps.mediaRecorder ? 'MediaRecorder ✓' : 'MediaRecorder ✗'),
        h(Tag, { color: caps.isTypeSupported ? 'success' : 'warning' }, caps.isTypeSupported ? 'isTypeSupported ✓' : 'isTypeSupported ✗'),
        h(Tag, { color: 'primary' }, `state: ${s.recorderState}`),
        s.recorderMime ? h(Tag, { color: 'primary' }, s.recorderMime) : null,
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：先检测 mimeType 支持，再用 captureStream(30) 的流构造 MediaRecorder。start(timeslice) 中 timeslice>0 每 N ms 产出一次 chunk；=0 仅在 stop 时一次性产出。pause/resume 暂停恢复；requestData 手动触发 dataavailable；stop 后合并 chunks 为 Blob 经 URL.createObjectURL 在 <video> 回放。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 mimeType 支持', { size: 'sm', disabled: !caps.mediaRecorder, onClick: () => this._checkMimeSupport() }),
          this._btn('start 默认 webm', { type: 'primary', size: 'sm', disabled: recDisabled, onClick: () => this._startRecorder('video/webm', 0) }),
          this._btn('start vp9 timeslice=1000', { size: 'sm', disabled: recDisabled, onClick: () => this._startRecorder('video/webm;codecs=vp9', 1000) }),
          this._btn('pause', { size: 'sm', disabled: !caps.mediaRecorder, onClick: () => this._pauseRecorder() }),
          this._btn('resume', { size: 'sm', disabled: !caps.mediaRecorder, onClick: () => this._resumeRecorder() }),
          this._btn('requestData', { size: 'sm', disabled: !caps.mediaRecorder, onClick: () => this._requestData() }),
          this._btn('stop', { size: 'sm', disabled: !caps.mediaRecorder, onClick: () => this._stopRecorder() }),
        ),
        h('canvas', {
          id: 'canvas-recorder', class: 'canvas-stage',
          width: 320, height: 200,
          style: { width: '320px', height: '200px', background: '#fff' },
        }),
        h('div', { class: 'fs-sm text-secondary mt-sm mb-xs' }, '录制回放：'),
        h('video', {
          id: 'video-recorder', controls: true,
          style: { width: '320px', background: '#000', borderRadius: '4px' },
        }),
        h(Alert, {
          type: 'info',
          message: 'MediaRecorder 状态机：inactive → recording → paused',
          description: 'recorder.state 取值 inactive/recording/paused。start() 进入 recording；pause()/resume() 切换 paused；stop() 回到 inactive 并触发 onstop。mimeType 候选：video/webm（默认）/vp9/vp8（Chrome/Firefox）、video/mp4（Safari）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const disabled = !caps.mediaRecorder || !caps.captureStream;
    const card = new Card({
      title: '4. 完整录制流程实战（End-to-End Recording）',
      desc: 'canvas → rAF 动画 → captureStream(30) → new MediaRecorder → start → 录制 N 秒 → stop → 合并 Blob → 回放。帧率控制（30fps vs requestFrame 手动）；码率控制（videoBitsPerSecond 影响画质与文件大小）；onerror/SecurityError/NotSupportedError 错误处理；内存管理：revokeObjectURL、stop track。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: disabled ? 'warning' : 'success' }, disabled ? '不可用' : '可用'),
        h(Tag, { color: 'primary' }, s.e2eProgress || '尚未录制'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：一键执行完整流程——启动 rAF 动画 → captureStream(30) → MediaRecorder（2.5Mbps）→ start → 3 秒后自动 stop → onstop 合并 Blob → URL.createObjectURL → <video> 回放。录制时长与文件大小正相关；码率越高画质越好但文件越大。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('录制 3 秒 (30fps, 2.5Mbps)', { type: 'primary', size: 'sm', disabled, onClick: () => this._runE2E(3) }),
          this._btn('停止', { size: 'sm', disabled, onClick: () => this._stopE2E(false) }),
        ),
        h('canvas', {
          id: 'canvas-e2e', class: 'canvas-stage',
          width: 320, height: 200,
          style: { width: '320px', height: '200px', background: '#fff' },
        }),
        h('div', { class: 'fs-sm text-secondary mt-sm mb-xs' }, '录制回放：'),
        h('video', {
          id: 'video-e2e', controls: true,
          style: { width: '320px', background: '#000', borderRadius: '4px' },
        }),
        h(Alert, {
          type: 'warning',
          message: '错误处理与内存管理',
          description: 'onerror 事件捕获录制异常：SecurityError（canvas 被 tainted，需 img.crossOrigin + CORS）、NotSupportedError（mimeType 不支持，用 isTypeSupported 预检）。录制完成后必须 revokeObjectURL 释放旧 URL、stop captureStream 的 track，避免内存泄漏。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const disabled = !caps.videoFrame || !caps.videoEncoder;
    const card = new Card({
      title: '5. WebCodecs 替代方案（WebCodecs Alternative）',
      desc: 'new VideoFrame(canvas, { timestamp }) 从 canvas 创建视频帧；new VideoEncoder({ output, error }) 创建编码器；encoder.configure({ codec, width, height, bitrate, framerate })；encoder.encode(frame, { keyFrame })；encoder.flush()。优势：帧级控制、低延迟、自定义容器、可接入 WebRTC；劣势：API 复杂、需手动封装 EncodedVideoChunk。浏览器支持：Chrome 94+。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.videoFrame ? 'success' : 'warning' }, caps.videoFrame ? 'VideoFrame ✓' : 'VideoFrame ✗'),
        h(Tag, { color: caps.videoEncoder ? 'success' : 'warning' }, caps.videoEncoder ? 'VideoEncoder ✓' : 'VideoEncoder ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：从 canvas 创建 10 个 VideoFrame（每帧 timestamp = i × 1e6/30 微秒），用 VideoEncoder 编码为 vp09（VP9）。每个 EncodedVideoChunk 经 output 回调收集，最后 flush() 刷出剩余数据。WebCodecs 提供帧级精确控制，比 MediaRecorder 黑盒更灵活，但需自行用 mp4-muxer / webm-muxer 等库封装容器。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('VideoFrame + VideoEncoder 编码 10 帧', { type: 'primary', size: 'sm', disabled, onClick: () => this._runWebCodecs() }),
        ),
        h('canvas', {
          id: 'canvas-codecs', class: 'canvas-stage',
          width: 320, height: 200,
          style: { width: '320px', height: '200px', background: '#fff' },
        }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, `编码信息：${s.codecsInfo || '—'}`),
        h(Alert, {
          type: 'info',
          message: 'WebCodecs vs MediaRecorder',
          description: 'MediaRecorder 是黑盒：start→stop 直接产出容器化文件，简单但不可控。WebCodecs 暴露 VideoFrame/VideoEncoder/EncodedVideoChunk，可精确控制每帧、自定义 GOP/码率/容器、接入 WebRTC 实时传输，但需手动处理容器封装。检测：typeof VideoEncoder !== "undefined"。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const disabled = !caps.mediaRecorder || !caps.captureStream || !caps.audioContext || !caps.mediaStreamDest;
    const card = new Card({
      title: '6. 音频混合录制（Audio + Canvas）',
      desc: 'new AudioContext() + createMediaStreamDestination() 创建音频目标节点；canvas.captureStream() + audioDestination.stream 合并；new MediaStream([...videoTracks, ...audioTracks]) 组合流；new MediaRecorder(combinedStream) 录制含音轨视频。场景：录制带背景音乐的 canvas 动画、游戏画面+音效。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.audioContext ? 'success' : 'warning' }, caps.audioContext ? 'AudioContext ✓' : 'AudioContext ✗'),
        h(Tag, { color: caps.mediaStreamDest ? 'success' : 'warning' }, caps.mediaStreamDest ? 'MediaStreamDest ✓' : 'MediaStreamDest ✗'),
        h(Tag, { color: 'primary' }, s.audioInfo || '尚未录制'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：创建 AudioContext + MediaStreamDestination，振荡器（440Hz 正弦波）经 Gain 连接到音频目标；canvas.captureStream(30) 取视频轨；new MediaStream([...视频轨, ...音频轨]) 合并；MediaRecorder 录制 3 秒含音轨视频。同时 Gain 连接到 audioCtx.destination 便于实时监听。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('录制 3 秒 (canvas + 440Hz 音频)', { type: 'primary', size: 'sm', disabled, onClick: () => this._runAudioRecording(3) }),
          this._btn('停止', { size: 'sm', disabled, onClick: () => this._stopAudioRecording(false) }),
        ),
        h('canvas', {
          id: 'canvas-audio', class: 'canvas-stage',
          width: 320, height: 200,
          style: { width: '320px', height: '200px', background: '#fff' },
        }),
        h('div', { class: 'fs-sm text-secondary mt-sm mb-xs' }, '录制回放（含音轨）：'),
        h('video', {
          id: 'video-audio', controls: true,
          style: { width: '320px', background: '#000', borderRadius: '4px' },
        }),
        h(Alert, {
          type: 'info',
          message: '音频混合：createMediaStreamDestination',
          description: 'AudioContext.createMediaStreamDestination() 返回一个 MediaStreamAudioDestinationNode，其 .stream 是含一条音频轨的 MediaStream。把视频轨（来自 captureStream）与音频轨合并为 new MediaStream([...]) 后交给 MediaRecorder，即可录制带声音的视频。AudioContext 全平台支持，captureStream 支持同 Card 2。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

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

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'Canvas 录制与媒体输出'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 Canvas 媒体输出全链路：静态导出（toDataURL/toBlob/convertToBlob）→ 实时流捕获（captureStream）→ MediaRecorder 录制 → 端到端实战 → WebCodecs 帧级编码 → 音频混合录制。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderLogPanel(),
    ];
  }
}
