// =====================================================================
// WebCodecsAPIPage.js —— WebCodecs API 编解码管线 完整 实验室
// 演示 W3C WebCodecs 标准低层级音视频编解码能力：
//   1. 概述与动机 —— 低层级编解码需求 / MSE+EME 高层封装局限 /
//      WebCodecs 标准 W3C / 浏览器支持 Chrome 94+/Safari 17+/Firefox 部分 /
//      与 MediaRecorder/WebAudio 对比
//   2. VideoEncoder —— new VideoEncoder({ output, error }) /
//      configure({ codec, width, height, bitrate, framerate, hardwareAcceleration }) /
//      encode(frame, { keyFrame }) / flush() / reset() / close() /
//      EncodedVideoChunk 输出
//   3. VideoDecoder —— new VideoDecoder({ output, error }) /
//      configure({ codec, hardwareAcceleration: 'no-preference'|'prefer-hardware'|'prefer-software' }) /
//      decode(encodedChunk) / flush() / 输出 VideoFrame / 硬件加速
//   4. VideoFrame —— new VideoFrame(canvas/imageBitmap/bufferSource,
//      { format, codedWidth, codedHeight, timestamp, duration }) /
//      format: I420/NV12/RGBA/BGRA / displayWidth/Height /
//      allocationSize() / copyTo() / close() 释放
//   5. AudioEncoder + AudioDecoder —— new AudioEncoder({ output, error }) /
//      codec: mp3/aac/flac/opus / encode(AudioData) /
//      AudioData 构造与 copyTo / 采样格式 PlanarS16/PackedS16
//   6. ImageDecoder —— ImageDecoder.isTypeSupported('image/avif') /
//      new ImageDecoder({ data, type, completeFramesFirst }) / decode({ frameIndex }) /
//      tracks 多帧/动图 / close() / 与 Image.decode() 对比
//   7. 实战：Canvas → VideoEncoder → MP4/WebM —— Canvas captureStream 替代方案 /
//      WebCodecs 编码 + mp4box.js 封装 / 实时视频处理管线 /
//      与 WebRTC RTCEncodedTransform 协同 / 录屏直播
//   8. 陷阱与最佳实践 —— codec 字符串完整列表（avc1.42E01E/vp09.00.10.08/
//      av01.0.04M.08/mp4a.40.2/opus）/ 硬件加速可用性查询 /
//      VideoFrame 必须手动 close() / 编码延迟与码率控制 /
//      keyFrame 周期 / 与 Web Worker 协同
// 说明：所有特性调用前做 typeof 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不实现 WebCodecs 全家桶，
//       VideoEncoder/VideoDecoder/VideoFrame/AudioEncoder/AudioDecoder/AudioData/
//       ImageDecoder/EncodedVideoChunk/EncodedAudioChunk 在 jsdom 均为 undefined，
//       统一 safe(()=>...) 兜底返回 false。注入演示样式 + 完整代码示例，
//       真实浏览器（Chrome 94+）可运行实际编解码管线。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class WebCodecsAPIPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',        // Card 1：概述与动机
      videoEncoderInfo: '',    // Card 2：VideoEncoder
      videoDecoderInfo: '',    // Card 3：VideoDecoder
      videoFrameInfo: '',      // Card 4：VideoFrame
      audioCodecInfo: '',      // Card 5：AudioEncoder + AudioDecoder
      imageDecoderInfo: '',    // Card 6：ImageDecoder
      pipelineInfo: '',        // Card 7：实战 Canvas → MP4/WebM
      pitfallsInfo: '',        // Card 8：陷阱与最佳实践
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];     // 动态创建并插入 head 的 <style> 元素列表
    this._videoEncoders = [];     // VideoEncoder 实例（componentWillUnmount 中 close）
    this._videoDecoders = [];     // VideoDecoder 实例
    this._audioEncoders = [];     // AudioEncoder 实例
    this._audioDecoders = [];     // AudioDecoder 实例
    this._imageDecoders = [];     // ImageDecoder 实例
    this._videoFrames = [];       // VideoFrame 实例（需手动 close）

    this._probeCodec = 'avc1.42E01E';        // Card 2 当前探测 codec
    this._decoderCodec = 'avc1.42E01E';      // Card 3 当前探测 codec
    this._hwAccel = 'no-preference';         // Card 3 硬件加速偏好
    this._frameFormat = 'RGBA';              // Card 4 VideoFrame format
    this._audioCodec = 'opus';               // Card 5 当前音频 codec
    this._imageType = 'image/avif';          // Card 6 当前 ImageDecoder type

    // 一次性能力检测：WebCodecs 全家桶
    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `VideoEncoder ${c(f.videoEncoder)}`,
      `VideoDecoder ${c(f.videoDecoder)}`,
      `VideoFrame ${c(f.videoFrame)}`,
      `AudioEncoder ${c(f.audioEncoder)}`,
      `AudioDecoder ${c(f.audioDecoder)}`,
      `AudioData ${c(f.audioData)}`,
      `ImageDecoder ${c(f.imageDecoder)}`,
      `EncodedVideoChunk ${c(f.encodedVideoChunk)}`,
      `EncodedAudioChunk ${c(f.encodedAudioChunk)}`,
      `isConfigSupported ${c(f.isConfigSupported)}`,
      `isTypeSupported ${c(f.isTypeSupported)}`,
    ];

    const summary = f.videoEncoder || f.videoDecoder
      ? `WebCodecs API 能力检测：${parts.join(' · ')}。当前环境支持 WebCodecs（Chrome 94+/Safari 17+），可运行实际编解码管线。VideoFrame 必须手动 close() 释放显存。jsdom 通常不实现 WebCodecs，按钮将仅记日志说明。`
      : `WebCodecs API 能力检测：${parts.join(' · ')}。当前环境（jsdom 或不支持 WebCodecs 的浏览器）不可用，所有按钮点击将仅记日志说明，不会抛异常。在 Chrome 94+/Safari 17+ 真实浏览器中打开可完整演示编解码管线。`;

    this.setState({ capsSummary: summary });
    this._addLog(f.videoEncoder ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.videoEncoder) this._addLog('warn', 'VideoEncoder 不可用（jsdom 不实现；Chrome 94+/Safari 17+ 支持，Firefox 部分支持 behind flag）');
    if (!f.videoDecoder) this._addLog('warn', 'VideoDecoder 不可用（jsdom 不实现；Chrome 94+/Safari 17+ 支持）');
    if (!f.videoFrame) this._addLog('warn', 'VideoFrame 不可用（jsdom 不实现；WebCodecs 帧数据容器）');
    if (!f.audioEncoder) this._addLog('warn', 'AudioEncoder 不可用（jsdom 不实现；Chrome 94+ 支持）');
    if (!f.imageDecoder) this._addLog('warn', 'ImageDecoder 不可用（jsdom 不实现；Chrome 94+/Safari 17+ 支持）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectDemoStyles();
  }

  componentWillUnmount() {
    this._destroyed = true;
    // 移除动态创建的 <style> 元素，便于 GC
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
    // 释放所有编解码器与帧资源
    const closeAll = (arr) => {
      for (const item of arr) {
        try { if (item && typeof item.close === 'function') item.close(); } catch { /* noop */ }
      }
    };
    closeAll(this._videoEncoders);
    closeAll(this._videoDecoders);
    closeAll(this._audioEncoders);
    closeAll(this._audioDecoders);
    closeAll(this._imageDecoders);
    closeAll(this._videoFrames);
    this._videoEncoders = [];
    this._videoDecoders = [];
    this._audioEncoders = [];
    this._audioDecoders = [];
    this._imageDecoders = [];
    this._videoFrames = [];
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

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  // jsdom 不可用时 safe 返回 false，绝不抛异常
  _flags() {
    const safe = (fn) => { try { return fn(); } catch { return false; } };
    return {
      videoEncoder: safe(() => typeof window.VideoEncoder === 'function'),
      videoDecoder: safe(() => typeof window.VideoDecoder === 'function'),
      videoFrame: safe(() => typeof window.VideoFrame !== 'undefined'),
      audioEncoder: safe(() => typeof window.AudioEncoder === 'function'),
      audioDecoder: safe(() => typeof window.AudioDecoder === 'function'),
      audioData: safe(() => typeof window.AudioData !== 'undefined'),
      imageDecoder: safe(() => typeof window.ImageDecoder === 'function'),
      encodedVideoChunk: safe(() => typeof window.EncodedVideoChunk !== 'undefined'),
      encodedAudioChunk: safe(() => typeof window.EncodedAudioChunk !== 'undefined'),
      isConfigSupported: safe(() => typeof VideoEncoder.isConfigSupported === 'function' &&
                                  typeof VideoDecoder.isConfigSupported === 'function'),
      isTypeSupported: safe(() => typeof VideoEncoder.isTypeSupported === 'function'),
    };
  }

  // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
  _injectStyle(id, textContent) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
    return style;
  }

  // —— 动态注入所有演示样式 ——
  _injectDemoStyles() {
    this._injectStyle('webcodecs-api-demo', `
      /* ===== 通用舞台 ===== */
      .wc-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 2/3：codec 探测表 ===== */
      .wc-codec-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 12px;
        font-family: monospace;
      }
      .wc-codec-table th, .wc-codec-table td {
        border: 1px solid #cbd5e1;
        padding: 4px 8px;
        text-align: left;
      }
      .wc-codec-table th { background: #e0e7ff; font-weight: 600; }
      .wc-codec-table .yes { color: #10b981; }
      .wc-codec-table .no { color: #ef4444; }
      .wc-codec-table .pending { color: #f59e0b; }
      /* ===== Card 4：VideoFrame format 说明 ===== */
      .wc-frame-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 8px;
        margin-top: 8px;
      }
      .wc-frame-cell {
        padding: 8px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #fff;
        font-size: 12px;
      }
      .wc-frame-cell .fmt { font-weight: 700; color: #3b82f6; }
      .wc-frame-cell .desc { color: #64748b; margin-top: 4px; }
      /* ===== Card 7：管线流程图 ===== */
      .wc-pipeline {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
        padding: 10px;
        background: #1e293b;
        border-radius: 6px;
        color: #e2e8f0;
        font-size: 12px;
        font-family: monospace;
      }
      .wc-pipeline .step {
        padding: 4px 10px;
        background: #334155;
        border-radius: 4px;
        border: 1px solid #475569;
      }
      .wc-pipeline .step.active { background: #1d4ed8; border-color: #3b82f6; }
      .wc-pipeline .arrow { color: #64748b; }
      /* ===== 输出区 ===== */
      .wc-output {
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

  // =================== Card 1：概述与动机 ===================

  _readOverviewInfo() {
    const f = this._flags();
    try {
      return `===== WebCodecs API 概述与动机 =====\n` +
        `\n` +
        `【规范归属】\n` +
        `  WebCodecs API 由 W3C WebCodecs Working Group 制定\n` +
        `  规范地址：https://www.w3.org/TR/webcodecs/\n` +
        `  状态：Editor's Draft / 部分进入 Candidate Recommendation\n` +
        `\n` +
        `【动机：低层级编解码需求】\n` +
        `  现有 Web 音视频 API 多为高层封装：\n` +
        `    MediaRecorder —— 仅支持录制为 WebM/MP4 整体文件，无法控制单帧\n` +
        `    MSE（Media Source Extensions）—— 只能播放已封装的 chunk，不能编码\n` +
        `    WebAudio —— 仅音频处理，不涉及压缩编解码\n` +
        `    RTCPeerConnection（WebRTC）—— 黑盒编码，无法自定义\n` +
        `  缺失能力：\n` +
        `    ✓ 直接访问硬件编码器/解码器（H.264/H.265/VP9/AV1）\n` +
        `    ✓ 逐帧编码/解码控制（keyFrame、码率、延迟）\n` +
        `    ✓ 自定义封装格式（mp4box.js / 自研 muxer）\n` +
        `    ✓ 实时视频处理（滤镜、AI 推理后再编码）\n` +
        `    ✓ 低延迟直播（< 100ms 端到端）\n` +
        `\n` +
        `【WebCodecs 提供】\n` +
        `  VideoEncoder / VideoDecoder —— 视频编解码\n` +
        `  AudioEncoder / AudioDecoder —— 音频编解码\n` +
        `  VideoFrame / AudioData —— 原始帧/采样数据容器\n` +
        `  ImageDecoder —— 图像（含动图 AVIF/WebP GIF）解码\n` +
        `  EncodedVideoChunk / EncodedAudioChunk —— 编码后数据容器\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  Chrome 94+（2021.09）—— 首次完整支持\n` +
        `  Edge 94+ —— 同 Chromium 内核\n` +
        `  Safari 17+（2023.09）—— 部分支持\n` +
        `  Firefox —— 部分支持（behind flag，逐步 ship）\n` +
        `  jsdom —— 不实现（typeof VideoEncoder === 'undefined'）\n` +
        `\n` +
        `【与 MediaRecorder/WebAudio 对比】\n` +
        `  MediaRecorder：高层录制，输出完整媒体文件，无法逐帧控制\n` +
        `    优势：简单易用；劣势：延迟高、格式受限、无法实时处理\n` +
        `  WebAudio：音频图处理（解码已压缩音频 + DSP），不编码\n` +
        `    优势：实时音频特效；劣势：不输出压缩流\n` +
        `  WebCodecs：低层级编解码，逐帧控制，可自定义封装\n` +
        `    优势：低延迟、可控、高性能；劣势：API 复杂，需手动管理资源\n` +
        `\n` +
        `【能力检测】\n` +
        `  VideoEncoder 可用 = ${f.videoEncoder}\n` +
        `  VideoDecoder 可用 = ${f.videoDecoder}\n` +
        `  VideoFrame 可用 = ${f.videoFrame}\n` +
        `  AudioEncoder 可用 = ${f.audioEncoder}\n` +
        `  AudioDecoder 可用 = ${f.audioDecoder}\n` +
        `  AudioData 可用 = ${f.audioData}\n` +
        `  ImageDecoder 可用 = ${f.imageDecoder}\n` +
        `  EncodedVideoChunk 可用 = ${f.encodedVideoChunk}\n` +
        `  EncodedAudioChunk 可用 = ${f.encodedAudioChunk}\n` +
        `  isConfigSupported 可用 = ${f.isConfigSupported}\n` +
        `  isTypeSupported 可用 = ${f.isTypeSupported}`;
    } catch (err) {
      return `读取 WebCodecs 概述信息失败：${err.name} - ${err.message}`;
    }
  }

  _runOverviewDemo() {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    const f = this._flags();
    this._addLog('info', `WebCodecs 概述演示：VideoEncoder=${f.videoEncoder}, VideoDecoder=${f.videoDecoder}, ImageDecoder=${f.imageDecoder}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— 低层级编解码 / W3C WebCodecs 标准',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['VideoEncoder', f.videoEncoder],
          ['VideoDecoder', f.videoDecoder],
          ['ImageDecoder', f.imageDecoder],
        ]),
        h(Tag, { color: 'primary' }, 'Chrome 94+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'WebCodecs API 由 W3C 制定，提供低层级音视频编解码能力，弥补 MediaRecorder（仅录制整体文件）/ MSE（仅播放已封装 chunk）/ WebAudio（仅 DSP 不编码）/ WebRTC（黑盒编码）的高层封装局限。提供 VideoEncoder/VideoDecoder、AudioEncoder/AudioDecoder、VideoFrame/AudioData、ImageDecoder、EncodedVideoChunk/EncodedAudioChunk。Chrome 94+ 首次完整支持，Safari 17+ 部分支持，Firefox 逐步 ship。jsdom 不实现，统一兜底。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取概述信息', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 WebCodecs API 全景）')),
        h(Alert, {
          type: 'info',
          message: 'WebCodecs 填补 Web 低层级编解码空白',
          description: '现有 MediaRecorder/MSE/WebAudio/WebRTC 均为高层封装，无法逐帧控制编码。WebCodecs 提供硬件加速的 VideoEncoder/VideoDecoder（H.264/H.265/VP9/AV1）、AudioEncoder/AudioDecoder（mp3/aac/flac/opus）、ImageDecoder（AVIF/WebP 多帧）。Chrome 94+ 完整支持，可结合 mp4box.js 自定义封装实现低延迟直播。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：VideoEncoder ===================

  _readVideoEncoderInfo() {
    const f = this._flags();
    try {
      return `===== VideoEncoder 编码器 =====\n` +
        `\n` +
        `【构造】\n` +
        `  const encoder = new VideoEncoder({\n` +
        `    output: (chunk, metadata) => {\n` +
        `      // chunk: EncodedVideoChunk\n` +
        `      // metadata: { decoderConfig, sidedata, alphaSideData }\n` +
        `      console.log('编码输出', chunk.type, chunk.byteLength);\n` +
        `    },\n` +
        `    error: (e) => console.error('编码错误', e),\n` +
        `  });\n` +
        `\n` +
        `【configure 编码配置】\n` +
        `  encoder.configure({\n` +
        `    codec: '${this._probeCodec}',          // 必填，codec 字符串\n` +
        `    width: 640,                    // 必填，像素\n` +
        `    height: 480,                   // 必填，像素\n` +
        `    bitrate: 2_000_000,            // 目标码率（bps）\n` +
        `    framerate: 30,                 // 帧率\n` +
        `    hardwareAcceleration: 'no-preference',  // 'prefer-hardware' | 'prefer-software'\n` +
        `    // H.264 专属：\n` +
        `    avc: { format: 'avc', keyFrameInterval: 30 },\n` +
        `    // VP9 专属：\n` +
        `    // vp9: { level: 'level2.0' },\n` +
        `    latencyMode: 'realtime',       // 'quality' | 'realtime'\n` +
        `  });\n` +
        `\n` +
        `【encode 编码单帧】\n` +
        `  const frame = new VideoFrame(canvas, { timestamp: 0, duration: 33333 });\n` +
        `  encoder.encode(frame, { keyFrame: true });  // 强制关键帧\n` +
        `  frame.close();  // ⚠ 必须手动 close 释放显存\n` +
        `\n` +
        `【flush 刷新】\n` +
        `  await encoder.flush();  // 等待所有挂起帧编码完成\n` +
        `\n` +
        `【reset / close】\n` +
        `  encoder.reset();  // 重置到未配置状态，丢弃挂起帧\n` +
        `  encoder.close();  // 释放底层资源，不可再用\n` +
        `\n` +
        `【EncodedVideoChunk 输出】\n` +
        `  output 回调收到 EncodedVideoChunk：\n` +
        `    chunk.type: 'key' | 'delta'\n` +
        `    chunk.timestamp: number（微秒）\n` +
        `    chunk.duration: number（微秒）\n` +
        `    chunk.byteLength: number\n` +
        `    chunk.copyTo(buf): 拷贝数据到 ArrayBuffer\n` +
        `\n` +
        `【能力检测】\n` +
        `  VideoEncoder 可用 = ${f.videoEncoder}\n` +
        `  VideoEncoder.isConfigSupported 可用 = ${f.isConfigSupported}\n` +
        `  VideoEncoder.isTypeSupported 可用 = ${f.isTypeSupported}\n` +
        `  当前探测 codec = '${this._probeCodec}'\n` +
        `\n` +
        `【常用 codec 字符串】\n` +
        `  H.264 (AVC)：avc1.42E01E（Baseline L3.0）/ avc1.4D401F（Main L3.1）/ avc1.640028（High L4.0）\n` +
        `  H.265 (HEVC)：hvc1.1.6.L93.B0（Chrome 部分支持，需 hardwareAcceleration）\n` +
        `  VP9：vp09.00.10.08（Profile 0 Level 2.0）\n` +
        `  AV1：av01.0.04M.08（Main Profile Level 4.0 8-bit）\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  Chrome 94+ / Edge 94+ —— 完整支持\n` +
        `  Safari 17+ —— 部分支持（H.264/HEVC）\n` +
        `  Firefox —— 部分支持（behind flag media.webcodecs.enabled）\n` +
        `  jsdom —— 不实现`;
    } catch (err) {
      return `读取 VideoEncoder 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setProbeCodec(codec) {
    this._probeCodec = codec;
    this.setState({ videoEncoderInfo: this._readVideoEncoderInfo() });
    this._addLog('info', `切换探测 codec → ${codec}`);
  }

  async _runVideoEncoderDemo() {
    const f = this._flags();
    if (!f.videoEncoder) {
      this._addLog('warn', `VideoEncoder 不可用（jsdom 不实现），无法运行真实编码演示；已输出代码示例`);
      this.setState({ videoEncoderInfo: this._readVideoEncoderInfo() });
      return;
    }
    // 真实浏览器：探测 isConfigSupported
    if (f.isConfigSupported) {
      try {
        const cfg = {
          codec: this._probeCodec,
          width: 640,
          height: 480,
          bitrate: 2_000_000,
          framerate: 30,
          hardwareAcceleration: this._hwAccel,
        };
        const result = await VideoEncoder.isConfigSupported(cfg);
        this._addLog(result.supported ? 'info' : 'warn',
          `VideoEncoder.isConfigSupported(${this._probeCodec}) → supported=${result.supported}` +
          (result.config ? ` (bitrate=${result.config.bitrate})` : ''));
      } catch (err) {
        this._addLog('warn', `VideoEncoder.isConfigSupported 调用失败：${err.name} - ${err.message}`);
      }
    } else {
      this._addLog('warn', 'VideoEncoder.isConfigSupported 不可用，跳过配置探测');
    }
    if (f.isTypeSupported) {
      try {
        const ok = VideoEncoder.isTypeSupported(this._probeCodec);
        this._addLog('info', `VideoEncoder.isTypeSupported('${this._probeCodec}') → ${ok}`);
      } catch (err) {
        this._addLog('warn', `VideoEncoder.isTypeSupported 调用失败：${err.name} - ${err.message}`);
      }
    }
    this.setState({ videoEncoderInfo: this._readVideoEncoderInfo() });
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const codecs = [
      ['avc1.42E01E', 'H.264 Baseline'],
      ['avc1.640028', 'H.264 High'],
      ['vp09.00.10.08', 'VP9'],
      ['av01.0.04M.08', 'AV1'],
    ];
    const card = new Card({
      title: '2. VideoEncoder —— configure / encode / flush / EncodedVideoChunk',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['VideoEncoder', f.videoEncoder],
          ['isConfigSupported', f.isConfigSupported],
        ]),
        h(Tag, { color: 'primary' }, 'H.264/VP9/AV1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'VideoEncoder 通过 new VideoEncoder({ output, error }) 构造，configure({ codec, width, height, bitrate, framerate, hardwareAcceleration }) 配置编码参数。encode(frame, { keyFrame }) 编码单个 VideoFrame，flush() 等待所有挂起帧完成，reset() 重置到未配置状态，close() 释放资源。output 回调收到 EncodedVideoChunk（type: key/delta，timestamp/duration 微秒，copyTo 拷贝数据）。hardwareAcceleration 支持 no-preference/prefer-hardware/prefer-software。codec 字符串如 avc1.42E01E（H.264 Baseline）、vp09.00.10.08（VP9）、av01.0.04M.08（AV1）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行编码演示', { type: 'primary', size: 'sm', onClick: () => this._runVideoEncoderDemo() }),
          ...codecs.map(([codec, name]) =>
            this._btn(name, { size: 'sm', onClick: () => this._setProbeCodec(codec) })),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '当前探测 codec：' + this._probeCodec),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.videoEncoderInfo || '（点击「运行编码演示」探测 codec 支持并查看完整代码）')),
        h(Alert, {
          type: 'info',
          message: 'VideoEncoder.isConfigSupported() 是探测配置可用性的标准方法',
          description: '编码前调用 VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate, hardwareAcceleration }) 返回 Promise<{ supported, config }>。isTypeSupported(codec) 仅检测 codec 字符串。hardwareAcceleration: prefer-hardware 启用 GPU 编码（低延迟高吞吐），prefer-software 强制软编（兼容性好）。jsdom 不实现，仅记日志。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：VideoDecoder ===================

  _readVideoDecoderInfo() {
    const f = this._flags();
    try {
      return `===== VideoDecoder 解码器 =====\n` +
        `\n` +
        `【构造】\n` +
        `  const decoder = new VideoDecoder({\n` +
        `    output: (frame) => {\n` +
        `      // frame: VideoFrame\n` +
        `      console.log('解码输出', frame.format, frame.codedWidth + 'x' + frame.codedHeight);\n` +
        `      frame.close();  // ⚠ 必须手动 close 释放显存\n` +
        `    },\n` +
        `    error: (e) => console.error('解码错误', e),\n` +
        `  });\n` +
        `\n` +
        `【configure 解码配置】\n` +
        `  decoder.configure({\n` +
        `    codec: '${this._decoderCodec}',\n` +
        `    codedWidth: 1920,         // 编码宽（可选，从 SPS 推断）\n` +
        `    codedHeight: 1080,        // 编码高\n` +
        `    hardwareAcceleration: '${this._hwAccel}',  // 'no-preference' | 'prefer-hardware' | 'prefer-software'\n` +
        `    description: byteArray,   // codec 私有数据（AVC SPS/PPS，HEVC VPS/SPS/PPS）\n` +
        `  });\n` +
        `\n` +
        `【decode 解码单 chunk】\n` +
        `  const chunk = new EncodedVideoChunk({\n` +
        `    type: 'key',              // 'key' | 'delta'\n` +
        `    timestamp: 0,             // 微秒\n` +
        `    duration: 33333,          // 微秒\n` +
        `    data: uint8Array,         // 编码数据\n` +
        `  });\n` +
        `  decoder.decode(chunk);\n` +
        `\n` +
        `【flush 刷新】\n` +
        `  await decoder.flush();  // 等待所有挂起 chunk 解码完成\n` +
        `\n` +
        `【reset / close】\n` +
        `  decoder.reset();\n` +
        `  decoder.close();\n` +
        `\n` +
        `【硬件加速】\n` +
        `  hardwareAcceleration 取值：\n` +
        `    'no-preference'   —— 浏览器自动选择（默认）\n` +
        `    'prefer-hardware' —— 优先 GPU 解码（低功耗高吞吐，移动端省电）\n` +
        `    'prefer-software' —— 优先 CPU 解码（兼容性好，避免 GPU 驱动 bug）\n` +
        `  硬件加速可用性查询：\n` +
        `    VideoDecoder.isConfigSupported({ codec, hardwareAcceleration: 'prefer-hardware' })\n` +
        `    返回 result.config.hardwareAcceleration 实际值（可能降级为 'prefer-software'）\n` +
        `\n` +
        `【能力检测】\n` +
        `  VideoDecoder 可用 = ${f.videoDecoder}\n` +
        `  VideoDecoder.isConfigSupported 可用 = ${f.isConfigSupported}\n` +
        `  EncodedVideoChunk 可用 = ${f.encodedVideoChunk}\n` +
        `  当前探测 codec = '${this._decoderCodec}'\n` +
        `  当前 hardwareAcceleration = '${this._hwAccel}'\n` +
        `\n` +
        `【解码管线】\n` +
        `  1. fetch MP4/WebM 文件 → mp4box.js/demuxer 解封装得到 EncodedVideoChunk[]\n` +
        `  2. decoder.configure({ codec, description: SPS/PPS })\n` +
        `  3. for (chunk of chunks) decoder.decode(chunk)\n` +
        `  4. await decoder.flush()\n` +
        `  5. output 回调收到 VideoFrame，可绘制到 canvas 或进一步处理\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  Chrome 94+ / Edge 94+ —— 完整支持\n` +
        `  Safari 17+ —— H.264/HEVC 解码\n` +
        `  Firefox —— 部分支持（behind flag）\n` +
        `  jsdom —— 不实现`;
    } catch (err) {
      return `读取 VideoDecoder 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setDecoderCodec(codec) {
    this._decoderCodec = codec;
    this.setState({ videoDecoderInfo: this._readVideoDecoderInfo() });
    this._addLog('info', `切换解码 codec → ${codec}`);
  }

  _setHwAccel(mode) {
    this._hwAccel = mode;
    this.setState({ videoDecoderInfo: this._readVideoDecoderInfo() });
    this._addLog('info', `切换 hardwareAcceleration → ${mode}`);
  }

  async _runVideoDecoderDemo() {
    const f = this._flags();
    if (!f.videoDecoder) {
      this._addLog('warn', `VideoDecoder 不可用（jsdom 不实现），无法运行真实解码演示；已输出代码示例`);
      this.setState({ videoDecoderInfo: this._readVideoDecoderInfo() });
      return;
    }
    if (f.isConfigSupported) {
      try {
        const cfg = {
          codec: this._decoderCodec,
          codedWidth: 1920,
          codedHeight: 1080,
          hardwareAcceleration: this._hwAccel,
        };
        const result = await VideoDecoder.isConfigSupported(cfg);
        this._addLog(result.supported ? 'info' : 'warn',
          `VideoDecoder.isConfigSupported(${this._decoderCodec}, hw=${this._hwAccel}) → supported=${result.supported}` +
          (result.config && result.config.hardwareAcceleration ? ` (actual hw=${result.config.hardwareAcceleration})` : ''));
      } catch (err) {
        this._addLog('warn', `VideoDecoder.isConfigSupported 调用失败：${err.name} - ${err.message}`);
      }
    } else {
      this._addLog('warn', 'VideoDecoder.isConfigSupported 不可用，跳过配置探测');
    }
    this.setState({ videoDecoderInfo: this._readVideoDecoderInfo() });
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const codecs = [
      ['avc1.42E01E', 'H.264'],
      ['vp09.00.10.08', 'VP9'],
      ['av01.0.04M.08', 'AV1'],
    ];
    const hwModes = ['no-preference', 'prefer-hardware', 'prefer-software'];
    const card = new Card({
      title: '3. VideoDecoder —— decode / flush / 硬件加速',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['VideoDecoder', f.videoDecoder],
          ['EncodedVideoChunk', f.encodedVideoChunk],
        ]),
        h(Tag, { color: 'primary' }, 'GPU 解码'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'VideoDecoder 通过 new VideoDecoder({ output, error }) 构造，configure({ codec, codedWidth, codedHeight, hardwareAcceleration, description }) 配置解码参数。description 接收 codec 私有数据（AVC SPS/PPS）。decode(EncodedVideoChunk) 解码单 chunk，flush() 等待完成，output 回调收到 VideoFrame（必须手动 close）。hardwareAcceleration: no-preference（默认）/prefer-hardware（GPU 省电）/prefer-software（兼容性）。VideoDecoder.isConfigSupported() 探测硬件加速实际可用性。Chrome 94+ 完整支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行解码演示', { type: 'primary', size: 'sm', onClick: () => this._runVideoDecoderDemo() }),
          ...codecs.map(([codec, name]) =>
            this._btn(name, { size: 'sm', onClick: () => this._setDecoderCodec(codec) })),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-sm' },
          h('span', { class: 'fs-sm text-secondary' }, '硬件加速：'),
          ...hwModes.map((mode) =>
            this._btn(mode, { size: 'sm', onClick: () => this._setHwAccel(mode) })),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' },
          '当前 codec：' + this._decoderCodec + ' / hardwareAcceleration：' + this._hwAccel),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.videoDecoderInfo || '（点击「运行解码演示」探测硬件加速并查看完整代码）')),
        h(Alert, {
          type: 'info',
          message: 'prefer-hardware 不保证一定用 GPU，需 isConfigSupported 探测实际值',
          description: 'hardwareAcceleration: prefer-hardware 是偏好而非强制，浏览器可能因驱动/格式限制降级为 software。VideoDecoder.isConfigSupported({ hardwareAcceleration: prefer-hardware }) 返回的 result.config.hardwareAcceleration 是实际生效值。移动端 GPU 解码更省电，桌面端高分辨率（4K/8K）需 GPU 加速。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：VideoFrame ===================

  _readVideoFrameInfo() {
    const f = this._flags();
    try {
      return `===== VideoFrame 帧数据容器 =====\n` +
        `\n` +
        `【构造来源】\n` +
        `  new VideoFrame(source, init)\n` +
        `  source 可为：\n` +
        `    HTMLCanvasElement / OffscreenCanvas —— 从 canvas 抓取当前帧\n` +
        `    ImageBitmap —— 从 ImageBitmap 创建\n` +
        `    ArrayBuffer / TypedArray —— 从原始像素数据创建（需指定 format/尺寸）\n` +
        `    另一个 VideoFrame —— 拷贝/转换格式\n` +
        `\n` +
        `【init 初始化参数】\n` +
        `  {\n` +
        `    format: '${this._frameFormat}',       // 像素格式\n` +
        `    codedWidth: 640,           // 编码宽\n` +
        `    codedHeight: 480,          // 编码高\n` +
        `    timestamp: 0,              // 微秒（必填）\n` +
        `    duration: 33333,           // 微秒\n` +
        `    visibleRect: { x, y, width, height },  // 可见区域\n` +
        `    displayWidth: 640,         // 显示宽（可不同于 codedWidth）\n` +
        `    displayHeight: 480,        // 显示高\n` +
        `    colorSpace: { primaries, transfer, matrix },  // 色彩空间\n` +
        `  }\n` +
        `\n` +
        `【format 像素格式】\n` +
        `  YUV 系列（视频常用，压缩率高）：\n` +
        `    I420 —— Planar YUV 4:2:0 8-bit（最常用，H.264/VP9 默认）\n` +
        `    I420A —— Planar YUV 4:2:0 + Alpha\n` +
        `    I422 —— Planar YUV 4:2:2\n` +
        `    I444 —— Planar YUV 4:4:4（高质量）\n` +
        `    NV12 —— Semi-planar YUV 4:2:0（硬件加速友好）\n` +
        `    P010 —— 10-bit YUV 4:2:0（HDR）\n` +
        `  RGBA/BGRA 系列（屏幕/Canvas 用）：\n` +
        `    RGBA —— 8-bit RGBA\n` +
        `    RGBX —— RGBA 但忽略 Alpha\n` +
        `    BGRA —— 8-bit BGRA（Canvas 默认）\n` +
        `    BGRX —— BGRA 但忽略 Alpha\n` +
        `\n` +
        `【属性】\n` +
        `  frame.format         —— 像素格式\n` +
        `  frame.codedWidth     —— 编码宽\n` +
        `  frame.codedHeight    —— 编码高\n` +
        `  frame.displayWidth   —— 显示宽（含 displayWidth/Height 缩放）\n` +
        `  frame.displayHeight  —— 显示高\n` +
        `  frame.timestamp      —— 微秒\n` +
        `  frame.duration       —— 微秒\n` +
        `  frame.colorSpace     —— VideoColorSpace\n` +
        `  frame.codedRect      —— DOMRectReadOnly\n` +
        `  frame.visibleRect    —— DOMRectReadOnly\n` +
        `\n` +
        `【allocationSize / copyTo】\n` +
        `  const size = frame.allocationSize({ rect, format });\n` +
        `  // 返回拷贝到 ArrayBuffer 所需字节数\n` +
        `  const buf = new ArrayBuffer(size);\n` +
        `  frame.copyTo(buf, { rect, format });\n` +
        `  // 拷贝像素数据到 buf，可指定子区域与目标格式（自动转换）\n` +
        `\n` +
        `【close 释放】\n` +
        `  ⚠⚠⚠ VideoFrame 必须手动 close() 释放！\n` +
        `  VideoFrame 持有 GPU/系统内存，不 close 会导致显存泄漏\n` +
        `  encoder.encode(frame) 后可立即 close\n` +
        `  decoder output 回调收到 frame 后处理完即 close\n` +
        `  frame.close() 后任何访问抛 InvalidStateError\n` +
        `\n` +
        `【能力检测】\n` +
        `  VideoFrame 可用 = ${f.videoFrame}\n` +
        `  当前 format = '${this._frameFormat}'\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  // Canvas → VideoFrame → 编码\n` +
        `  const canvas = new OffscreenCanvas(640, 480);\n` +
        `  const ctx = canvas.getContext('2d');\n` +
        `  ctx.fillStyle = 'red';\n` +
        `  ctx.fillRect(0, 0, 640, 480);\n` +
        `  const frame = new VideoFrame(canvas, { timestamp: 0, duration: 33333 });\n` +
        `  encoder.encode(frame, { keyFrame: true });\n` +
        `  frame.close();  // ★ 必须释放\n` +
        `\n` +
        `  // 从原始像素创建\n` +
        `  const yuv = new Uint8Array(640 * 480 * 1.5);  // I420 尺寸 = w*h*1.5\n` +
        `  const frame2 = new VideoFrame(yuv, {\n` +
        `    format: 'I420',\n` +
        `    codedWidth: 640,\n` +
        `    codedHeight: 480,\n` +
        `    timestamp: 0,\n` +
        `  });\n` +
        `  frame2.close();`;
    } catch (err) {
      return `读取 VideoFrame 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setFrameFormat(fmt) {
    this._frameFormat = fmt;
    this.setState({ videoFrameInfo: this._readVideoFrameInfo() });
    this._addLog('info', `切换 VideoFrame format → ${fmt}`);
  }

  _runVideoFrameDemo() {
    const f = this._flags();
    if (!f.videoFrame) {
      this._addLog('warn', `VideoFrame 不可用（jsdom 不实现），无法创建真实帧；已输出代码示例`);
    } else {
      this._addLog('info', `VideoFrame 可用，format=${this._frameFormat}（实际创建需 canvas/pixel 数据）`);
    }
    this.setState({ videoFrameInfo: this._readVideoFrameInfo() });
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const formats = [
      ['I420', 'Planar YUV 4:2:0（最常用）', 'video'],
      ['NV12', 'Semi-planar YUV 4:2:0（硬件友好）', 'video'],
      ['I444', 'Planar YUV 4:4:4（高质量）', 'video'],
      ['RGBA', '8-bit RGBA', 'screen'],
      ['BGRA', '8-bit BGRA（Canvas 默认）', 'screen'],
    ];
    const card = new Card({
      title: '4. VideoFrame —— format / allocationSize / copyTo / close',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['VideoFrame', f.videoFrame]]),
        h(Tag, { color: 'warning' }, '⚠ 必须 close'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'VideoFrame 是原始视频帧容器，可从 Canvas/ImageBitmap/ArrayBuffer/另一个 VideoFrame 构造。init 指定 format（I420/NV12/I444/RGBA/BGRA 等）、codedWidth/codedHeight、timestamp（微秒，必填）、duration、displayWidth/displayHeight、colorSpace。format 分 YUV 系列（I420 最常用、NV12 硬件友好、I444 高质量）与 RGBA/BGRA 系列（屏幕/Canvas）。allocationSize({ rect, format }) 返回拷贝字节数，copyTo(buf, { rect, format }) 拷贝像素（可自动格式转换）。⚠ VideoFrame 必须手动 close() 释放显存，否则泄漏。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 VideoFrame 演示', { type: 'primary', size: 'sm', onClick: () => this._runVideoFrameDemo() }),
          ...formats.map(([fmt]) =>
            this._btn(fmt, { size: 'sm', onClick: () => this._setFrameFormat(fmt) })),
        ),
        h('div', { class: 'wc-frame-grid' },
          formats.map(([fmt, desc, type]) =>
            h('div', { class: 'wc-frame-cell' },
              h('div', { class: 'fmt' }, fmt),
              h('div', { class: 'desc' }, desc + ' [' + type + ']'),
            )),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.videoFrameInfo || '（点击按钮查看 VideoFrame 完整说明）')),
        h(Alert, {
          type: 'warning',
          message: 'VideoFrame 必须手动 close() 释放显存',
          description: 'VideoFrame 持有 GPU/系统内存，不 close 会导致显存泄漏。encoder.encode(frame) 后立即 close；decoder output 回调处理完即 close。close 后任何访问抛 InvalidStateError。I420 是 H.264/VP9 默认格式（YUV 4:2:0，尺寸 = w*h*1.5），NV12 对硬件加速更友好，RGBA/BGRA 用于 Canvas 交互。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：AudioEncoder + AudioDecoder ===================

  _readAudioCodecInfo() {
    const f = this._flags();
    try {
      return `===== AudioEncoder + AudioDecoder 音频编解码 =====\n` +
        `\n` +
        `【AudioEncoder 构造】\n` +
        `  const encoder = new AudioEncoder({\n` +
        `    output: (chunk, metadata) => {\n` +
        `      // chunk: EncodedAudioChunk\n` +
        `      // metadata: { decoderConfig }\n` +
        `    },\n` +
        `    error: (e) => console.error(e),\n` +
        `  });\n` +
        `\n` +
        `【configure 音频编码配置】\n` +
        `  encoder.configure({\n` +
        `    codec: '${this._audioCodec}',          // mp3/aac/flac/opus/pcm\n` +
        `    sampleRate: 48000,        // 采样率\n` +
        `    numberOfChannels: 2,      // 声道数\n` +
        `    bitrate: 128000,          // 目标码率（bps）\n` +
        `    // opus 专属：\n` +
        `    opus: { application: 'voip' | 'audio' | 'lowdelay' },\n` +
        `  });\n` +
        `\n` +
        `【AudioData 原始音频容器】\n` +
        `  const data = new AudioData({\n` +
        `    format: 's16',            // 采样格式\n` +
        `    sampleRate: 48000,\n` +
        `    numberOfFrames: 480,      // 帧数（每帧 = 1 采样点）\n` +
        `    numberOfChannels: 2,\n` +
        `    timestamp: 0,             // 微秒\n` +
        `    data: int16Array,         // 交错/平面排列的采样数据\n` +
        `  });\n` +
        `  encoder.encode(data);\n` +
        `  data.close();  // ⚠ 必须手动 close\n` +
        `\n` +
        `【采样格式 AudioSampleFormat】\n` +
        `  Planar 系列（每声道独立平面）：\n` +
        `    's16'  → PlanarS16 / 'u8'  → PlanarU8\n` +
        `    's32'  → PlanarS32 / 'f32' → PlanarF32\n` +
        `  Packed 系列（交错排列）：\n` +
        `    's16-planar' 实际是 PlanarS16（命名易混淆）\n` +
        `    PackedS16 = 's16'（部分实现用 's16' 表 Packed，'s16-planar' 表 Planar）\n` +
        `  实际规范定义：\n` +
        `    'u8' | 's16' | 's32' | 'f32' | 'u8-planar' | 's16-planar' | 's32-planar' | 'f32-planar'\n` +
        `    不带 -planar 后缀 = Packed（交错），带 -planar = Planar（分平面）\n` +
        `\n` +
        `【AudioDecoder 构造】\n` +
        `  const decoder = new AudioDecoder({\n` +
        `    output: (data) => {\n` +
        `      // data: AudioData\n` +
        `      const size = data.allocationSize();\n` +
        `      const buf = new ArrayBuffer(size);\n` +
        `      data.copyTo(buf);\n` +
        `      data.close();\n` +
        `    },\n` +
        `    error: (e) => console.error(e),\n` +
        `  });\n` +
        `  decoder.configure({\n` +
        `    codec: '${this._audioCodec}',\n` +
        `    sampleRate: 48000,\n` +
        `    numberOfChannels: 2,\n` +
        `    description: codecPrivateData,  // 可选\n` +
        `  });\n` +
        `  const chunk = new EncodedAudioChunk({ type: 'key', timestamp: 0, data: uint8Array });\n` +
        `  decoder.decode(chunk);\n` +
        `\n` +
        `【常用音频 codec】\n` +
        `  mp3  —— 'mp3'（解码 Chrome 94+，编码受限）\n` +
        `  aac  —— 'mp4a.40.2'（AAC-LC）/ 'mp4a.40.5'（HE-AAC）\n` +
        `  flac —— 'flac'（无损）\n` +
        `  opus —— 'opus'（WebRTC 默认，低延迟）\n` +
        `  pcm  —— 'pcm'（未压缩）\n` +
        `\n` +
        `【能力检测】\n` +
        `  AudioEncoder 可用 = ${f.audioEncoder}\n` +
        `  AudioDecoder 可用 = ${f.audioDecoder}\n` +
        `  AudioData 可用 = ${f.audioData}\n` +
        `  EncodedAudioChunk 可用 = ${f.encodedAudioChunk}\n` +
        `  当前 codec = '${this._audioCodec}'\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  Chrome 94+ / Edge 94+ —— 完整支持\n` +
        `  Safari 17+ —— 部分支持\n` +
        `  Firefox —— 部分支持（behind flag）\n` +
        `  jsdom —— 不实现`;
    } catch (err) {
      return `读取音频编解码信息失败：${err.name} - ${err.message}`;
    }
  }

  _setAudioCodec(codec) {
    this._audioCodec = codec;
    this.setState({ audioCodecInfo: this._readAudioCodecInfo() });
    this._addLog('info', `切换音频 codec → ${codec}`);
  }

  _runAudioCodecDemo() {
    const f = this._flags();
    if (!f.audioEncoder || !f.audioDecoder) {
      this._addLog('warn', `AudioEncoder=${f.audioEncoder} / AudioDecoder=${f.audioDecoder}（jsdom 不实现），仅输出代码示例`);
    } else {
      this._addLog('info', `AudioEncoder/Decoder 可用，codec=${this._audioCodec}`);
    }
    this.setState({ audioCodecInfo: this._readAudioCodecInfo() });
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const codecs = [
      ['opus', 'Opus（低延迟）'],
      ['mp4a.40.2', 'AAC-LC'],
      ['mp3', 'MP3'],
      ['flac', 'FLAC（无损）'],
    ];
    const card = new Card({
      title: '5. AudioEncoder + AudioDecoder —— opus/aac/flac/pcm',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['AudioEncoder', f.audioEncoder],
          ['AudioDecoder', f.audioDecoder],
          ['AudioData', f.audioData],
        ]),
        h(Tag, { color: 'primary' }, 'PlanarS16/PackedS16'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'AudioEncoder 通过 new AudioEncoder({ output, error }) 构造，configure({ codec, sampleRate, numberOfChannels, bitrate }) 配置。codec 支持 mp3/aac(mp4a.40.2)/flac/opus/pcm。encode(AudioData) 编码原始采样。AudioData 构造需指定 format（s16/s32/f32 带 -planar 后缀为 Planar 平面，不带为 Packed 交错）、sampleRate、numberOfFrames、numberOfChannels、timestamp、data。AudioDecoder.decode(EncodedAudioChunk) 解码，output 回调收到 AudioData（allocationSize/copyTo/close）。AudioData 也必须手动 close()。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行音频编解码演示', { type: 'primary', size: 'sm', onClick: () => this._runAudioCodecDemo() }),
          ...codecs.map(([codec, name]) =>
            this._btn(name, { size: 'sm', onClick: () => this._setAudioCodec(codec) })),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '当前音频 codec：' + this._audioCodec),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.audioCodecInfo || '（点击按钮查看音频编解码完整说明）')),
        h(Alert, {
          type: 'info',
          message: 'AudioData format 命名：带 -planar 后缀为平面布局，不带为交错布局',
          description: '采样格式：u8/s16/s32/f32（Packed 交错）+ u8-planar/s16-planar/s32-planar/f32-planar（Planar 平面）。Planar 每声道独立平面（适合 DSP），Packed 各声道采样点交错排列（适合 I/O）。opus 是 WebRTC 默认低延迟 codec，aac(mp4a.40.2) 适合流媒体，flac 无损存档。AudioData 也必须 close() 释放。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：ImageDecoder ===================

  _readImageDecoderInfo() {
    const f = this._flags();
    try {
      return `===== ImageDecoder 图像解码 =====\n` +
        `\n` +
        `【能力检测：isTypeSupported】\n` +
        `  ImageDecoder.isTypeSupported('image/avif')  // → Promise<boolean>\n` +
        `  ImageDecoder.isTypeSupported('image/webp')\n` +
        `  ImageDecoder.isTypeSupported('image/png')\n` +
        `  ImageDecoder.isTypeSupported('image/gif')\n` +
        `  ImageDecoder.isTypeSupported('image/jpeg')\n` +
        `\n` +
        `【构造】\n` +
        `  const decoder = new ImageDecoder({\n` +
        `    data: ArrayBuffer,        // 图像二进制数据\n` +
        `    type: '${this._imageType}',         // MIME 类型\n` +
        `    completeFramesFirst: false,  // 是否先完整解析所有帧\n` +
        `    premultiplyAlpha: 'default', // 'default' | 'premultiply' | 'none'\n` +
        `    colorSpaceConversion: 'default',  // 'default' | 'none'\n` +
        `    desiredWidth: 0,          // 解码目标宽（0 = 原始）\n` +
        `    desiredHeight: 0,\n` +
        `  });\n` +
        `\n` +
        `【decode 解码单帧】\n` +
        `  const result = await decoder.decode({\n` +
        `    frameIndex: 0,            // 帧索引（动图用）\n` +
        `    completeFramesOnly: false,\n` +
        `  });\n` +
        `  // result: { image: VideoFrame, complete }\n` +
        `  // image 是 VideoFrame，可绘制到 canvas 或 copyTo 提取像素\n` +
        `  result.image.close();\n` +
        `\n` +
        `【tracks 多帧/动图】\n` +
        `  decoder.tracks —— ReadableStream\n` +
        `    decoder.tracks.length —— 轨道数（通常 1）\n` +
        `    decoder.tracks[0].animated —— 是否动图\n` +
        `    decoder.tracks[0].frameCount —— 总帧数\n` +
        `    decoder.tracks[0].repetitionCount —— 循环次数\n` +
        `  解码动图所有帧：\n` +
        `    for (let i = 0; i < track.frameCount; i++) {\n` +
        `      const { image } = await decoder.decode({ frameIndex: i });\n` +
        `      // 绘制 image 到 canvas...\n` +
        `      image.close();\n` +
        `    }\n` +
        `\n` +
        `【close 释放】\n` +
        `  decoder.close();  // 释放底层资源\n` +
        `\n` +
        `【与 Image.decode() 对比】\n` +
        `  HTMLImageElement + Image.decode()：\n` +
        `    高层 API，仅渲染到屏幕，无法逐帧控制\n` +
        `    不支持动图逐帧提取\n` +
        `    无法获取原始像素数据\n` +
        `  ImageDecoder：\n` +
        `    低层级，逐帧解码，可获取 VideoFrame\n` +
        `    支持 AVIF/WebP/GIF 动图逐帧\n` +
        `    可指定目标尺寸（desiredWidth/Height）\n` +
        `    可控制色彩空间转换与 Alpha 预乘\n` +
        `\n` +
        `【能力检测】\n` +
        `  ImageDecoder 可用 = ${f.imageDecoder}\n` +
        `  当前 type = '${this._imageType}'\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  Chrome 94+ / Edge 94+ —— 完整支持（AVIF/WebP/GIF/PNG/JPEG）\n` +
        `  Safari 17+ —— 部分支持\n` +
        `  Firefox —— 部分支持（behind flag）\n` +
        `  jsdom —— 不实现`;
    } catch (err) {
      return `读取 ImageDecoder 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setImageType(type) {
    this._imageType = type;
    this.setState({ imageDecoderInfo: this._readImageDecoderInfo() });
    this._addLog('info', `切换 ImageDecoder type → ${type}`);
  }

  async _runImageDecoderDemo() {
    const f = this._flags();
    if (!f.imageDecoder) {
      this._addLog('warn', `ImageDecoder 不可用（jsdom 不实现），无法运行 isTypeSupported；已输出代码示例`);
      this.setState({ imageDecoderInfo: this._readImageDecoderInfo() });
      return;
    }
    try {
      const supported = await ImageDecoder.isTypeSupported(this._imageType);
      this._addLog(supported ? 'info' : 'warn',
        `ImageDecoder.isTypeSupported('${this._imageType}') → ${supported}`);
    } catch (err) {
      this._addLog('warn', `ImageDecoder.isTypeSupported 调用失败：${err.name} - ${err.message}`);
    }
    this.setState({ imageDecoderInfo: this._readImageDecoderInfo() });
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const types = [
      ['image/avif', 'AVIF（现代）'],
      ['image/webp', 'WebP'],
      ['image/gif', 'GIF（动图）'],
      ['image/png', 'PNG'],
      ['image/jpeg', 'JPEG'],
    ];
    const card = new Card({
      title: '6. ImageDecoder —— isTypeSupported / decode / tracks 动图',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['ImageDecoder', f.imageDecoder]]),
        h(Tag, { color: 'primary' }, 'AVIF/WebP/GIF'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ImageDecoder 提供低层级图像解码。ImageDecoder.isTypeSupported(\'image/avif\') 静态方法探测 MIME 类型支持。new ImageDecoder({ data, type, completeFramesFirst, premultiplyAlpha, colorSpaceConversion, desiredWidth/Height }) 构造。decode({ frameIndex }) 解码单帧返回 { image: VideoFrame, complete }。tracks 属性提供多轨道/动图信息（tracks[0].animated / frameCount / repetitionCount）。close() 释放。与 HTMLImageElement.decode() 对比：ImageDecoder 支持逐帧动图、原始像素提取、目标尺寸控制、色彩空间转换控制，更底层灵活。Chrome 94+ 完整支持 AVIF/WebP/GIF/PNG/JPEG。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 ImageDecoder 演示', { type: 'primary', size: 'sm', onClick: () => this._runImageDecoderDemo() }),
          ...types.map(([type, name]) =>
            this._btn(name, { size: 'sm', onClick: () => this._setImageType(type) })),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '当前探测 type：' + this._imageType),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.imageDecoderInfo || '（点击按钮探测类型支持并查看完整代码）')),
        h(Alert, {
          type: 'info',
          message: 'ImageDecoder 是 Image.decode() 的低层级替代，支持逐帧动图',
          description: 'Image.decode() 仅渲染到屏幕，无法逐帧控制或提取像素。ImageDecoder 输出 VideoFrame 可绘制到 canvas、copyTo 提取像素、或送入 VideoEncoder 重新编码。AVIF/WebP 动图可通过 tracks[0].frameCount 遍历所有帧，实现 GIF 替代方案。completeFramesFirst: false 支持流式解码（边下载边解码）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 7：实战：Canvas → VideoEncoder → MP4/WebM ===================

  _readPipelineInfo() {
    const f = this._flags();
    try {
      return `===== 实战：Canvas → VideoEncoder → MP4/WebM =====\n` +
        `\n` +
        `【方案对比】\n` +
        `  传统：canvas.captureStream() + MediaRecorder\n` +
        `    优势：简单（一行 captureStream + new MediaRecorder）\n` +
        `    劣势：仅输出 WebM/MP4 整体文件，无法控制 keyFrame/码率/延迟\n` +
        `  WebCodecs：canvas → VideoFrame → VideoEncoder → EncodedVideoChunk → muxer\n` +
        `    优势：逐帧控制、自定义封装、低延迟、可实时处理\n` +
        `    劣势：需手动管理 muxer（mp4box.js / 自研）\n` +
        `\n` +
        `【完整管线代码】\n` +
        `  // 1. 准备 canvas\n` +
        `  const canvas = new OffscreenCanvas(1280, 720);\n` +
        `  const ctx = canvas.getContext('2d');\n` +
        `\n` +
        `  // 2. 配置 VideoEncoder\n` +
        `  const encoder = new VideoEncoder({\n` +
        `    output: (chunk, meta) => {\n` +
        `      // 4. 写入 muxer（mp4box.js）\n` +
        `      mp4file.addSample(chunk, meta);\n` +
        `    },\n` +
        `    error: (e) => console.error(e),\n` +
        `  });\n` +
        `  encoder.configure({\n` +
        `    codec: 'avc1.42E01E',\n` +
        `    width: 1280, height: 720,\n` +
        `    bitrate: 4_000_000,\n` +
        `    framerate: 30,\n` +
        `    latencyMode: 'realtime',\n` +
        `  });\n` +
        `\n` +
        `  // 3. 逐帧编码循环\n` +
        `  let frameIdx = 0;\n` +
        `  function renderFrame() {\n` +
        `    // 绘制内容\n` +
        `    ctx.fillStyle = 'hsl(' + (frameIdx * 2) + ', 80%, 50%)';\n` +
        `    ctx.fillRect(0, 0, 1280, 720);\n` +
        `    ctx.fillStyle = '#fff';\n` +
        `    ctx.font = '48px sans-serif';\n` +
        `    ctx.fillText('Frame ' + frameIdx, 50, 100);\n` +
        `\n` +
        `    // 创建 VideoFrame 并编码\n` +
        `    const frame = new VideoFrame(canvas, {\n` +
        `      timestamp: frameIdx * 33333,\n` +
        `      duration: 33333,\n` +
        `    });\n` +
        `    encoder.encode(frame, { keyFrame: frameIdx % 30 === 0 });\n` +
        `    frame.close();  // ★ 释放\n` +
        `    frameIdx++;\n` +
        `\n` +
        `    if (frameIdx < 300) requestAnimationFrame(renderFrame);\n` +
        `    else encoder.flush().then(() => mp4file.save());\n` +
        `  }\n` +
        `  renderFrame();\n` +
        `\n` +
        `【与 mp4box.js 协同封装 MP4】\n` +
        `  mp4box.js（https://github.com/gpac/mp4box.js）提供 ISO BMFF muxer：\n` +
        `    const mp4file = MP4Box.createFile();\n` +
        `    mp4file.addTrack({ codec: 'avc', width, height, duration, timescale });\n` +
        `    // output 回调中：\n` +
        `    mp4file.addSample(trackId, chunkData, {\n` +
        `      duration: chunk.duration,\n` +
        `      dts: chunk.timestamp,\n` +
        `      cts: chunk.timestamp,\n` +
        `      is_sync: chunk.type === 'key',\n` +
        `    });\n` +
        `  最终 mp4file.getBuffer() 得到 MP4 文件\n` +
        `\n` +
        `【WebM 封装（VP9/AV1）】\n` +
        `  WebM 容器用 ebml.js 或自研 WebM muxer：\n` +
        `    VP9 codec 'vp09.00.10.08' + WebM 容器\n` +
        `    AV1 codec 'av01.0.04M.08' + WebM/MP4 容器\n` +
        `\n` +
        `【实时视频处理管线】\n` +
        `  Camera → VideoFrame → 滤镜/AI 推理 → VideoFrame → VideoEncoder → 网络\n` +
        `  getUserMedia → canvas drawImage → ImageData 像素处理 → VideoFrame → encode\n` +
        `  适合：美颜滤镜、背景虚化、物体检测叠加、AR 特效\n` +
        `\n` +
        `【与 WebRTC RTCEncodedTransform 协同】\n` +
        `  RTCEncodedVideoFrame（WebRTC 内部帧）可转为 VideoFrame 处理后再转回：\n` +
        `    transform: (encodedFrame, controller) => {\n` +
        `      // 解码 → 处理 → 重新编码\n` +
        `      // 用于 WebRTC 中间帧处理（加密、水印、AI 推理）\n` +
        `      controller.enqueue(encodedFrame);\n` +
        `    }\n` +
        `  注册：RTCRtpSender.transform = new TransformStream({ transform });\n` +
        `\n` +
        `【录屏直播】\n` +
        `  getDisplayMedia → VideoFrame → VideoEncoder → WebSocket/WHIP → 观众\n` +
        `  低延迟（< 200ms）：latencyMode: 'realtime' + 短 keyFrame 间隔\n` +
        `\n` +
        `【能力检测】\n` +
        `  VideoEncoder 可用 = ${f.videoEncoder}\n` +
        `  VideoFrame 可用 = ${f.videoFrame}\n` +
        `  EncodedVideoChunk 可用 = ${f.encodedVideoChunk}`;
    } catch (err) {
      return `读取管线实战信息失败：${err.name} - ${err.message}`;
    }
  }

  _runPipelineDemo() {
    const f = this._flags();
    if (!f.videoEncoder || !f.videoFrame) {
      this._addLog('warn', `VideoEncoder=${f.videoEncoder} / VideoFrame=${f.videoFrame}（jsdom 不实现），无法运行真实管线；已输出完整代码示例`);
    } else {
      this._addLog('info', `管线就绪：Canvas → VideoFrame → VideoEncoder → muxer（Chrome 94+ 可运行）`);
    }
    this.setState({ pipelineInfo: this._readPipelineInfo() });
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战 —— Canvas → VideoEncoder → MP4/WebM 管线',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['VideoEncoder', f.videoEncoder],
          ['VideoFrame', f.videoFrame],
        ]),
        h(Tag, { color: 'primary' }, 'mp4box.js / RTCEncodedTransform'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Canvas → VideoEncoder → MP4/WebM 完整管线：相比 canvas.captureStream()+MediaRecorder（仅整体文件），WebCodecs 提供逐帧控制与自定义封装。流程：OffscreenCanvas 绘制 → new VideoFrame(canvas, {timestamp, duration}) → VideoEncoder.encode(frame, {keyFrame}) → output 回调收到 EncodedVideoChunk → mp4box.js 封装 MP4 或 ebml.js 封装 WebM。扩展场景：实时视频处理（Camera → 像素处理 → 编码）、WebRTC RTCEncodedTransform 协同（WebRTC 帧中间处理）、录屏直播（getDisplayMedia → 编码 → WHIP 推流）。latencyMode: realtime 实现低延迟。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行管线演示', { type: 'primary', size: 'sm', onClick: () => this._runPipelineDemo() }),
        ),
        h('div', { class: 'wc-pipeline' },
          h('span', { class: 'step' }, 'Canvas'),
          h('span', { class: 'arrow' }, '→'),
          h('span', { class: 'step' }, 'VideoFrame'),
          h('span', { class: 'arrow' }, '→'),
          h('span', { class: 'step active' }, 'VideoEncoder'),
          h('span', { class: 'arrow' }, '→'),
          h('span', { class: 'step' }, 'EncodedVideoChunk'),
          h('span', { class: 'arrow' }, '→'),
          h('span', { class: 'step' }, 'mp4box.js'),
          h('span', { class: 'arrow' }, '→'),
          h('span', { class: 'step' }, 'MP4 文件'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pipelineInfo || '（点击「运行管线演示」查看完整 Canvas→MP4 管线代码）')),
        h(Alert, {
          type: 'info',
          message: 'WebCodecs + mp4box.js 是 MediaRecorder 的低延迟可控替代方案',
          description: 'MediaRecorder 仅输出整体文件、无法控制 keyFrame/码率/延迟。WebCodecs 逐帧编码 + mp4box.js 封装 MP4 / ebml.js 封装 WebM，可精确控制 keyFrame 周期、码率、latencyMode。RTCEncodedTransform 可在 WebRTC 管线中插入帧处理（水印/加密/AI）。录屏直播用 latencyMode: realtime + 短 keyFrame 间隔实现 < 200ms 延迟。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 8：陷阱与最佳实践 ===================

  _readPitfallsInfo() {
    const f = this._flags();
    try {
      return `===== WebCodecs 陷阱与最佳实践 =====\n` +
        `\n` +
        `【陷阱 1：codec 字符串完整列表】\n` +
        `  codec 字符串必须精确匹配规范格式，否则 configure 抛 NotSupportedError：\n` +
        `  H.264 (AVC)：\n` +
        `    avc1.42E01E  —— Baseline Profile Level 3.0\n` +
        `    avc1.42E02A  —— Baseline Level 4.2\n` +
        `    avc1.4D401F  —— Main Profile Level 3.1\n` +
        `    avc1.4D4028  —— Main Level 4.0\n` +
        `    avc1.640028  —— High Profile Level 4.0\n` +
        `    avc1.640032  —— High Level 5.0\n` +
        `  H.265 (HEVC)：\n` +
        `    hvc1.1.6.L93.B0  —— Main Profile Level 3.1\n` +
        `    hvc1.1.6.L120.B0 —— Main Level 4.0\n` +
        `  VP9：\n` +
        `    vp09.00.10.08  —— Profile 0 Level 2.0 8-bit\n` +
        `    vp09.00.21.08  —— Profile 0 Level 3.1\n` +
        `    vp09.02.10.10  —— Profile 2 Level 2.0 10-bit\n` +
        `  AV1：\n` +
        `    av01.0.04M.08  —— Main Profile Level 4.0 8-bit\n` +
        `    av01.0.08M.10  —— Main Profile Level 8.0 10-bit\n` +
        `  音频：\n` +
        `    mp4a.40.2  —— AAC-LC\n` +
        `    mp4a.40.5  —— HE-AAC\n` +
        `    opus       —— Opus\n` +
        `    flac       —— FLAC\n` +
        `    mp3        —— MP3\n` +
        `  ⚠ 错误示例：'h264' / 'H.264' / 'vp9' 均无效，必须用规范字符串\n` +
        `\n` +
        `【陷阱 2：硬件加速可用性查询】\n` +
        `  hardwareAcceleration: 'prefer-hardware' 不保证一定用 GPU：\n` +
        `    浏览器可能因驱动 bug / 格式不支持降级为 software\n` +
        `  正确查询方式：\n` +
        `    const result = await VideoEncoder.isConfigSupported({\n` +
        `      codec: 'avc1.42E01E',\n` +
        `      hardwareAcceleration: 'prefer-hardware',\n` +
        `      width: 1920, height: 1080,\n` +
        `    });\n` +
        `    // result.config.hardwareAcceleration 是实际生效值\n` +
        `    if (result.config.hardwareAcceleration !== 'prefer-hardware') {\n` +
        `      console.warn('硬件加速不可用，降级为 software');\n` +
        `    }\n` +
        `\n` +
        `【陷阱 3：VideoFrame 必须手动 close()】\n` +
        `  ⚠⚠⚠ VideoFrame 持有 GPU/系统内存，不 close 会导致显存泄漏！\n` +
        `  编码后立即 close：\n` +
        `    encoder.encode(frame, { keyFrame: true });\n` +
        `    frame.close();  // ★ 编码后立即释放\n` +
        `  解码 output 回调中 close：\n` +
        `    output: (frame) => {\n` +
        `      // 处理 frame（绘制到 canvas 等）\n` +
        `      frame.close();  // ★ 处理完立即释放\n` +
        `    }\n` +
        `  close 后访问任何属性抛 InvalidStateError\n` +
        `  AudioData 同理必须 close()\n` +
        `\n` +
        `【陷阱 4：编码延迟与码率控制】\n` +
        `  latencyMode 取值：\n` +
        `    'quality'  —— 默认，高延迟高质量（适合文件转码）\n` +
        `    'realtime' —— 低延迟（适合直播/实时通信）\n` +
        `  码率控制模式（部分 codec 支持）：\n` +
        `    bitrate: 目标码率（bps）\n` +
        `    framerate: 目标帧率\n` +
        `    bitrate 的实际行为依赖 encoder 实现，可能波动\n` +
        `  低延迟最佳实践：\n` +
        `    latencyMode: 'realtime'\n` +
        `    framerate: 30\n` +
        `    bitrate: 2_000_000  // 根据分辨率调整\n` +
        `    keyFrame 周期短（如每 30 帧）\n` +
        `\n` +
        `【陷阱 5：keyFrame 周期】\n` +
        `  encode(frame, { keyFrame: true }) 强制关键帧\n` +
        `  周期建议：\n` +
        `    直播：每 1-2 秒一个 keyFrame（30fps → 每 30-60 帧）\n` +
        `    文件转码：可更长（每 5-10 秒）\n` +
        `    WebRTC：通常 1 秒一个 keyFrame\n` +
        `  keyFrame 过密：码率暴涨；过疏：seek 困难、抗丢包差\n` +
        `  H.264 用 avc.keyFrameInterval 配置：\n` +
        `    configure({ avc: { format: 'avc', keyFrameInterval: 60 } })\n` +
        `\n` +
        `【陷阱 6：与 Web Worker 协同】\n` +
        `  WebCodecs 编解码是 CPU/GPU 密集型，应在 Worker 中运行避免阻塞主线程：\n` +
        `    主线程：postMessage(canvas.transferControlToOffscreen())\n` +
        `    Worker：接收 OffscreenCanvas → VideoFrame → VideoEncoder\n` +
        `  VideoFrame 支持跨 Worker 传输（transferable）：\n` +
        `    postMessage(frame, [frame])  // 转移所有权，原侧不可再用\n` +
        `  ImageDecoder 也可在 Worker 中使用\n` +
        `\n` +
        `【陷阱 7：错误处理】\n` +
        `  error 回调收到 DOMException，常见类型：\n` +
        `    NotSupportedError —— codec/配置不支持\n` +
        `    InvalidStateError —— 未 configure 就 encode，或 close 后访问\n` +
        `    EncodingError —— 编码失败（数据损坏）\n` +
        `    OperationError —— 中断/超时\n` +
        `  configure 后检查 encoder.state：'configured' | 'unconfigured' | 'closed'\n` +
        `\n` +
        `【最佳实践清单】\n` +
        `  ✓ 编码前用 isConfigSupported 探测配置\n` +
        `  ✓ codec 字符串用规范格式（avc1.42E01E 而非 'h264'）\n` +
        `  ✓ VideoFrame/AudioData 用完立即 close() 释放\n` +
        `  ✓ 实时场景用 latencyMode: 'realtime' + 短 keyFrame\n` +
        `  ✓ 硬件加速用 isConfigSupported 查询实际生效值\n` +
        `  ✓ 重活放 Worker，VideoFrame 可跨 Worker 转移\n` +
        `  ✓ configure 后检查 encoder.state 确认配置成功\n` +
        `  ✓ error 回调妥善处理 DOMException\n` +
        `  ✓ 组件卸载时 close 所有 encoder/decoder/frame\n` +
        `  ✓ 降级方案：MediaRecorder / WebRTC for older browsers\n` +
        `\n` +
        `【能力检测】\n` +
        `  VideoEncoder = ${f.videoEncoder}\n` +
        `  VideoDecoder = ${f.videoDecoder}\n` +
        `  ImageDecoder = ${f.imageDecoder}\n` +
        `  isConfigSupported = ${f.isConfigSupported}\n` +
        `  isTypeSupported = ${f.isTypeSupported}`;
    } catch (err) {
      return `读取陷阱与最佳实践信息失败：${err.name} - ${err.message}`;
    }
  }

  _runPitfallsDemo() {
    const f = this._flags();
    this.setState({ pitfallsInfo: this._readPitfallsInfo() });
    this._addLog('info', `陷阱与最佳实践演示：VideoEncoder=${f.videoEncoder}, isConfigSupported=${f.isConfigSupported}`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 陷阱与最佳实践 —— codec 字符串 / 硬件加速 / close / Worker',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['isConfigSupported', f.isConfigSupported],
          ['isTypeSupported', f.isTypeSupported],
        ]),
        h(Tag, { color: 'warning' }, '7 大陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '七大陷阱：codec 字符串必须规范格式（avc1.42E01E/vp09.00.10.08/av01.0.04M.08/mp4a.40.2/opus，非 h264/H.264/vp9）；硬件加速可用性查询（prefer-hardware 不保证，需 isConfigSupported 看 result.config 实际值）；VideoFrame 必须手动 close() 释放显存（编码后立即 close，解码 output 处理完即 close）；编码延迟与码率控制（latencyMode: realtime 低延迟，quality 高延迟）；keyFrame 周期（直播每 1-2 秒，文件可更长）；与 Web Worker 协同（重活放 Worker，VideoFrame 可 transferable 转移）；错误处理（DOMException: NotSupportedError/InvalidStateError/EncodingError）。最佳实践 10 条覆盖探测/格式/释放/延迟/硬件/Worker/错误处理/降级。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', onClick: () => this._runPitfallsDemo() }),
        ),
        h('table', { class: 'wc-codec-table' },
          h('thead', {},
            h('tr', {}, h('th', {}, '类别'), h('th', {}, 'codec 字符串'), h('th', {}, '说明')),
          ),
          h('tbody', {},
            h('tr', {}, h('td', {}, 'H.264'), h('td', {}, 'avc1.42E01E'), h('td', {}, 'Baseline L3.0')),
            h('tr', {}, h('td', {}, 'H.264'), h('td', {}, 'avc1.640028'), h('td', {}, 'High L4.0')),
            h('tr', {}, h('td', {}, 'VP9'), h('td', {}, 'vp09.00.10.08'), h('td', {}, 'Profile 0 L2.0')),
            h('tr', {}, h('td', {}, 'AV1'), h('td', {}, 'av01.0.04M.08'), h('td', {}, 'Main L4.0 8-bit')),
            h('tr', {}, h('td', {}, 'AAC'), h('td', {}, 'mp4a.40.2'), h('td', {}, 'AAC-LC')),
            h('tr', {}, h('td', {}, 'Opus'), h('td', {}, 'opus'), h('td', {}, '低延迟')),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看 7 大陷阱与 10 条最佳实践）')),
        h(Alert, {
          type: 'warning',
          message: 'VideoFrame 必须手动 close()；codec 字符串必须规范格式',
          description: '陷阱清单：codec 字符串规范（avc1.42E01E 非 h264）；硬件加速需 isConfigSupported 查实际值；VideoFrame/AudioData 必须 close 释放显存；latencyMode: realtime 低延迟；keyFrame 周期直播 1-2 秒；Web Worker 协同（transferable 转移）；DOMException 错误处理。降级方案：MediaRecorder for older browsers。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

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

  // =================== 渲染入口 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page webcodecs-api-page' },
      h('h2', { class: 'section-title' }, 'WebCodecs API 编解码管线 完整实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 W3C WebCodecs API 低层级音视频编解码：VideoEncoder/VideoDecoder（H.264/VP9/AV1）、VideoFrame（I420/NV12/RGBA）、AudioEncoder/AudioDecoder（opus/aac/flac）、ImageDecoder（AVIF/WebP/GIF 动图）、Canvas→MP4/WebM 管线（mp4box.js/RTCEncodedTransform）、陷阱与最佳实践（codec 字符串/硬件加速/close/Worker）。所有特性通过 typeof 能力检测，不可用时仅记日志，绝不抛异常。jsdom 不实现 WebCodecs，真实浏览器（Chrome 94+）可运行实际编解码。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderCard7(),
      this._renderCard8(),
      this._renderLogPanel(),
    );
  }
}
