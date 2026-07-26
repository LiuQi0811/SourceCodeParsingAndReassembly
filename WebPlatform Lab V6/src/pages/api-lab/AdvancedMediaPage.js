// =====================================================================
// AdvancedMediaPage.js —— 媒体扩展与高级特性实验室
// 演示 MDN：
//   1. Media Source Extensions（MediaSource / addSourceBuffer / SourceBuffer.mode /
//      appendBuffer / remove / abort / SourceBufferList 事件 addsourcebuffer /
//      removesourcebuffer / URL.createObjectURL(mediaSource) /
//      MediaSource.isTypeSupported / endOfStream）
//   2. Picture-in-Picture（HTMLVideoElement.requestPictureInPicture /
//      document.pictureInPictureElement / document.exitPictureInPicture /
//      enterpictureinpicture / leavepictureinpicture / resize /
//      PictureInPictureWindow.width/height）
//      Document PiP（window.documentPictureInPicture.requestWindow /
//      documentPictureInPicture.window / enter / leave）
//   3. Media Capabilities API（navigator.mediaCapabilities.decodingInfo /
//      encodingInfo / configuration: type+video+audio / 返回 supported /
//      smooth / powerEfficient）
//   4. Encrypted Media Extensions（navigator.requestMediaKeySystemAccess /
//      keySystem 如 com.widevine.alpha / org.w3.clearkey /
//      getConfiguration / createMediaKeys / createSession /
//      HTMLMediaElement.setMediaKeys）
//      Text Tracks（HTMLMediaElement.textTracks / TextTrack.kind/label/language/
//      mode/cues/addCue/removeCue / VTTCue.startTime/endTime/text/line/position/
//      size/align / <track> 元素）
//   5. MediaStreamTrack 深入与 Insertable Streams（MediaStreamTrack.kind/id/
//      label/enabled/muted/readyState / getCapabilities / getConstraints /
//      applyConstraints / clone / stop / unmute/mute/ended/overconstrained 事件 /
//      MediaStreamTrackGenerator / MediaStreamTrackProcessor）
// =====================================================================

import { Page } from '../../core/Component.js';
import { h, formatTime, errInfo } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// ===================== 模块级常量 =====================

const MSE_MIME_TYPES = [
  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  'video/mp4; codecs="hev1.1.6.L93.B0"',
  'video/webm; codecs="vp9, opus"',
  'video/webm; codecs="vp8, vorbis"',
  'audio/mp4; codecs="mp4a.40.2"',
  'audio/webm; codecs="opus"',
];

const DECODE_CONFIGS = [
  { name: 'H.264 1080p', config: { type: 'media-source', video: { contentType: 'video/mp4; codecs="avc1.42E01E"', width: 1920, height: 1080, bitrate: 5_000_000, framerate: 30 } } },
  { name: 'VP9 4K', config: { type: 'media-source', video: { contentType: 'video/webm; codecs="vp9"', width: 3840, height: 2160, bitrate: 20_000_000, framerate: 60 } } },
  { name: 'AV1 1080p', config: { type: 'file', video: { contentType: 'video/mp4; codecs="av01.0.04M.08"', width: 1920, height: 1080, bitrate: 4_000_000, framerate: 30 } } },
  { name: 'HEVC 1080p', config: { type: 'file', video: { contentType: 'video/mp4; codecs="hev1.1.6.L93.B0"', width: 1920, height: 1080, bitrate: 6_000_000, framerate: 30 } } },
];

const ENCODE_CONFIGS = [
  { name: 'VP8 录制', config: { type: 'record', video: { contentType: 'video/webm; codecs="vp8"', width: 1280, height: 720, bitrate: 2_000_000, framerate: 30 } } },
  { name: 'VP9 录制', config: { type: 'record', video: { contentType: 'video/webm; codecs="vp9"', width: 1280, height: 720, bitrate: 2_000_000, framerate: 30 } } },
  { name: 'H.264 录制', config: { type: 'record', video: { contentType: 'video/mp4; codecs="avc1.42E01E"', width: 1280, height: 720, bitrate: 2_000_000, framerate: 30 } } },
];

const EME_KEY_SYSTEMS = ['com.widevine.alpha', 'com.apple.fps.1_0', 'org.w3.clearkey'];

const SAMPLE_CUES = [
  { start: 0, end: 3, text: '欢迎来到 Advanced Media Lab' },
  { start: 3, end: 6, text: '此处演示 TextTrack + VTTCue' },
  { start: 6, end: 9, text: '字幕通过 addCue 动态添加' },
  { start: 9, end: 12, text: 'mode: showing / hidden / disabled' },
];

export class AdvancedMediaPage extends Page {
  initialState() {
    return {
      logs: [],
      mseSupported: null, mimeResults: [], mseStatus: '未创建',
      pipSupported: null, docPipSupported: null, pipActive: false, docPipActive: false, pipWindowSize: '',
      mcSupported: null, decodeResults: [], encodeResults: [],
      emeSupported: null, emeResults: [], textTracksList: [], vttCues: [],
      trackSupported: null, generatorSupported: null, trackInfo: '',
    };
  }

  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    this._bindControls();
    if (this._inited) return;
    this._inited = true;
    this._detectMSE();
    this._detectPiP();
    this._detectMediaCapabilities();
    this._detectEME();
    this._detectTrack();
  }

  componentWillUnmount() {
    // 1. 关闭 MediaSource（endOfStream + revokeObjectURL）
    if (this._mediaSource) {
      try { if (this._mediaSource.readyState === 'open') this._mediaSource.endOfStream(); } catch { /* noop */ }
      this._mediaSource = null;
    }
    if (this._mseUrl) { try { URL.revokeObjectURL(this._mseUrl); } catch { /* noop */ } this._mseUrl = null; }
    // 2. 退出 Picture-in-Picture
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      try { document.exitPictureInPicture().catch(() => {}); } catch { /* noop */ }
    }
    // 3. 关闭 Document PiP 窗口
    if (this._docPipWindow) { try { this._docPipWindow.close(); } catch { /* noop */ } this._docPipWindow = null; }
    // 4. 停止 MediaStreamTrack
    if (this._mediaStream) {
      try { this._mediaStream.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } }); } catch { /* noop */ }
      this._mediaStream = null;
    }
    if (this._streamTrack) { try { this._streamTrack.stop(); } catch { /* noop */ } this._streamTrack = null; }
    // 5. 暂停视频元素，撤销 src
    if (this._videoEl) {
      try { this._videoEl.pause(); this._videoEl.removeAttribute('src'); this._videoEl.load(); } catch { /* noop */ }
      this._videoEl = null;
    }
    if (this._trackVideoEl) { try { this._trackVideoEl.pause(); } catch { /* noop */ } this._trackVideoEl = null; }
    // 6. 关闭 MediaKeys session
    if (this._keySession) { try { this._keySession.close().catch(() => {}); } catch { /* noop */ } this._keySession = null; }
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

  _bindControls() {
    const video = this.$('.mse-video');
    if (video) {
      this._videoEl = video;
      this.on(video, 'enterpictureinpicture', () => {
        this.setState({ pipActive: true });
        this._addLog('pip', 'enterpictureinpicture：视频进入画中画');
      });
      this.on(video, 'leavepictureinpicture', () => {
        this.setState({ pipActive: false, pipWindowSize: '' });
        this._addLog('pip', 'leavepictureinpicture：视频离开画中画');
      });
    }
    const trackVideo = this.$('.track-video');
    if (trackVideo) {
      this._trackVideoEl = trackVideo;
      this.on(trackVideo, 'enterpictureinpicture', () => this._addLog('info', '字幕视频元素进入 PiP'));
    }
  }

  // ===================== Card 1: Media Source Extensions =====================

  _detectMSE() {
    const supported = typeof MediaSource !== 'undefined';
    const mimeResults = [];
    if (supported) {
      for (const mime of MSE_MIME_TYPES) {
        let ok = false;
        try { ok = MediaSource.isTypeSupported(mime); } catch { ok = false; }
        mimeResults.push({ mime, ok });
      }
    }
    this.setState({
      mseSupported: supported,
      mimeResults,
      logs: [...this.state.logs, {
        type: 'mse',
        content: supported
          ? `MediaSource 可用；isTypeSupported 检测 ${mimeResults.length} 个 MIME`
          : 'MediaSource 不可用（typeof MediaSource === "undefined"）',
        time: formatTime(),
      }].slice(-40),
    });
  }

  _createMSE() {
    if (typeof MediaSource === 'undefined') {
      this._addLog('error', 'MediaSource 不可用，无法创建实例');
      return;
    }
    try {
      const ms = new MediaSource();
      this._mediaSource = ms;
      // SourceBufferList 事件：addsourcebuffer / removesourcebuffer
      this.on(ms.sourceBuffers, 'addsourcebuffer', () => {
        this._addLog('mse', `SourceBufferList.addsourcebuffer：sourceBuffers.length=${ms.sourceBuffers.length}`);
      });
      this.on(ms.sourceBuffers, 'removesourcebuffer', () => {
        this._addLog('mse', `SourceBufferList.removesourcebuffer：sourceBuffers.length=${ms.sourceBuffers.length}`);
      });
      this.on(ms, 'sourceopen', () => {
        this._addLog('mse', `MediaSource.sourceopen：readyState=${ms.readyState}`);
        const mime = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
        let sb = null;
        try {
          sb = ms.addSourceBuffer(mime);
          this._addLog('mse', `addSourceBuffer("${mime}") ✓ mode=${sb.mode}`);
        } catch (err) {
          this._addLog('error', `addSourceBuffer 失败：${errInfo(err).message}`);
          return;
        }
        // SourceBuffer 事件
        this.on(sb, 'updatestart', () => this._addLog('mse', 'SourceBuffer.updatestart'));
        this.on(sb, 'update', () => this._addLog('mse', 'SourceBuffer.update'));
        this.on(sb, 'updateend', () => this._addLog('mse', `SourceBuffer.updateend · buffered.length=${sb.buffered.length}`));
        this.on(sb, 'error', (e) => this._addLog('error', `SourceBuffer.error：${e?.message || 'unknown'}`));
        this.on(sb, 'abort', () => this._addLog('mse', 'SourceBuffer.abort'));
        this._sourceBuffer = sb;
        this.setState({ mseStatus: `sourceopen · mode=${sb.mode}` });
      });
      this.on(ms, 'sourceended', () => this._addLog('mse', `MediaSource.sourceended：readyState=${ms.readyState}`));
      this.on(ms, 'sourceclosed', () => {
        this._addLog('mse', `MediaSource.sourceclosed：readyState=${ms.readyState}`);
        this.setState({ mseStatus: 'closed' });
      });
      // URL.createObjectURL(mediaSource) 生成 video.src
      this._mseUrl = URL.createObjectURL(ms);
      if (this._videoEl) this._videoEl.src = this._mseUrl;
      this._addLog('info', `URL.createObjectURL(mediaSource) → ${this._mseUrl.slice(0, 48)}…`);
      this.setState({ mseStatus: `created · readyState=${ms.readyState}` });
    } catch (err) {
      this._addLog('error', `MediaSource 创建异常：${errInfo(err).message}`);
    }
  }

  _mseAbort() {
    const sb = this._sourceBuffer;
    if (!sb) { this._addLog('error', 'SourceBuffer 尚未创建'); return; }
    try { sb.abort(); this._addLog('mse', 'sourceBuffer.abort() ✓'); }
    catch (err) { this._addLog('error', `sourceBuffer.abort 失败：${errInfo(err).message}`); }
  }

  _mseRemove() {
    const sb = this._sourceBuffer;
    if (!sb) { this._addLog('error', 'SourceBuffer 尚未创建'); return; }
    try { sb.remove(0, 1); this._addLog('mse', 'sourceBuffer.remove(0, 1) ✓'); }
    catch (err) { this._addLog('error', `sourceBuffer.remove 失败：${errInfo(err).message}`); }
  }

  _mseEndOfStream() {
    const ms = this._mediaSource;
    if (!ms) { this._addLog('error', 'MediaSource 尚未创建'); return; }
    try { ms.endOfStream(); this._addLog('mse', `mediaSource.endOfStream() ✓ readyState=${ms.readyState}`); }
    catch (err) { this._addLog('error', `endOfStream 失败：${errInfo(err).message}`); }
  }

  // ===================== Card 2: Picture-in-Picture =====================

  _detectPiP() {
    const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
    const docPipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
    this.setState({
      pipSupported,
      docPipSupported,
      logs: [...this.state.logs, {
        type: 'pip',
        content: `PiP: ${pipSupported ? '可用' : '不可用（document.pictureInPictureEnabled === false）'}；Document PiP: ${docPipSupported ? '可用' : '不可用（"documentPictureInPicture" not in window）'}`,
        time: formatTime(),
      }].slice(-40),
    });
  }

  _requestPiP() {
    const v = this._videoEl;
    if (!v) { this._addLog('error', '未找到视频元素'); return; }
    if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) {
      this._addLog('error', 'document.pictureInPictureEnabled === false，无法请求 PiP');
      return;
    }
    if (typeof v.requestPictureInPicture !== 'function') {
      this._addLog('error', 'HTMLVideoElement.requestPictureInPicture 不可用');
      return;
    }
    v.play().then(() => v.requestPictureInPicture())
      .then((pipWin) => {
        this._pipWindow = pipWin;
        this.on(pipWin, 'resize', () => {
          this.setState({ pipWindowSize: `${pipWin.width}×${pipWin.height}` });
          this._addLog('pip', `PictureInPictureWindow.resize：${pipWin.width}×${pipWin.height}`);
        });
        this.setState({ pipWindowSize: `${pipWin.width}×${pipWin.height}` });
        this._addLog('pip', `requestPictureInPicture ✓ → window ${pipWin.width}×${pipWin.height}`);
      })
      .catch((err) => this._addLog('error', `requestPictureInPicture 失败：${errInfo(err).message}`));
  }

  _exitPiP() {
    if (typeof document === 'undefined' || !document.pictureInPictureElement) {
      this._addLog('error', 'document.pictureInPictureElement === null，当前未在 PiP');
      return;
    }
    document.exitPictureInPicture()
      .then(() => this._addLog('pip', 'document.exitPictureInPicture() ✓'))
      .catch((err) => this._addLog('error', `exitPictureInPicture 失败：${errInfo(err).message}`));
  }

  _requestDocPiP() {
    if (!('documentPictureInPicture' in window)) {
      this._addLog('error', 'window.documentPictureInPicture 不可用');
      return;
    }
    const dpi = window.documentPictureInPicture;
    const target = this.$('.doc-pip-content');
    if (!target) { this._addLog('error', '未找到待转移的 DOM 节点'); return; }
    dpi.requestWindow({ width: 360, height: 240 })
      .then((pipWin) => {
        this._docPipWindow = pipWin;
        // 复制样式表到 PiP 窗口
        try {
          [...document.styleSheets].forEach((sheet) => {
            try {
              const css = [...sheet.cssRules].map((r) => r.cssText).join('\n');
              const style = pipWin.document.createElement('style');
              style.textContent = css;
              pipWin.document.head.appendChild(style);
            } catch { /* 跨域样式表 */ }
          });
        } catch { /* noop */ }
        // 把页面 DOM 节点移过去（演示 DOM 转移）
        pipWin.document.body.appendChild(target);
        this._docPipPlaceholder = h('div', { class: 'log-panel__empty', style: { padding: '16px' } },
          '（内容已转移到 Document PiP 窗口，关闭窗口后会回来）');
        target.parentNode?.appendChild(this._docPipPlaceholder);
        this.on(dpi, 'enter', () => this._addLog('pip', 'documentPictureInPicture.enter'));
        this.on(pipWin, 'pagehide', () => {
          try {
            if (this._docPipPlaceholder?.parentNode) this._docPipPlaceholder.parentNode.replaceChild(target, this._docPipPlaceholder);
            this._docPipPlaceholder = null;
          } catch { /* noop */ }
          this._docPipWindow = null;
          this.setState({ docPipActive: false });
          this._addLog('pip', 'Document PiP 窗口已关闭，DOM 节点已移回');
        });
        this.setState({ docPipActive: true });
        this._addLog('pip', `documentPictureInPicture.requestWindow({360×240}) ✓ → 把 .doc-pip-content 转移过去`);
      })
      .catch((err) => this._addLog('error', `requestWindow 失败：${errInfo(err).message}`));
  }

  _closeDocPiP() {
    if (!this._docPipWindow) { this._addLog('error', 'Document PiP 窗口未打开'); return; }
    try { this._docPipWindow.close(); this._addLog('pip', 'documentPictureInPicture.window.close() ✓'); }
    catch (err) { this._addLog('error', `close 失败：${errInfo(err).message}`); }
  }

  // ===================== Card 3: Media Capabilities =====================

  _detectMediaCapabilities() {
    const supported = typeof navigator !== 'undefined' && !!navigator.mediaCapabilities &&
      typeof navigator.mediaCapabilities.decodingInfo === 'function';
    this.setState({
      mcSupported: supported,
      logs: [...this.state.logs, {
        type: 'info',
        content: supported
          ? 'navigator.mediaCapabilities 可用（decodingInfo / encodingInfo）'
          : 'navigator.mediaCapabilities 不可用',
        time: formatTime(),
      }].slice(-40),
    });
  }

  async _runDecodeInfo() {
    if (!this.state.mcSupported) {
      this._addLog('error', 'navigator.mediaCapabilities 不可用，无法调用 decodingInfo');
      return;
    }
    this._addLog('info', `开始 decodingInfo 检测 ${DECODE_CONFIGS.length} 项配置…`);
    const results = [];
    for (const item of DECODE_CONFIGS) {
      try {
        const info = await navigator.mediaCapabilities.decodingInfo(item.config);
        results.push({ name: item.name, supported: info.supported, smooth: info.smooth, powerEfficient: info.powerEfficient });
        this._addLog('info', `decodingInfo("${item.name}") → supported=${info.supported}, smooth=${info.smooth}, powerEfficient=${info.powerEfficient}`);
      } catch (err) {
        results.push({ name: item.name, supported: false, smooth: false, powerEfficient: false, error: errInfo(err).message });
        this._addLog('error', `decodingInfo("${item.name}") 异常：${errInfo(err).message}`);
      }
    }
    this.setState({ decodeResults: results });
  }

  async _runEncodeInfo() {
    if (!this.state.mcSupported) {
      this._addLog('error', 'navigator.mediaCapabilities 不可用，无法调用 encodingInfo');
      return;
    }
    this._addLog('info', `开始 encodingInfo 检测 ${ENCODE_CONFIGS.length} 项配置…`);
    const results = [];
    for (const item of ENCODE_CONFIGS) {
      try {
        const info = await navigator.mediaCapabilities.encodingInfo(item.config);
        results.push({ name: item.name, supported: info.supported, smooth: info.smooth, powerEfficient: info.powerEfficient });
        this._addLog('info', `encodingInfo("${item.name}") → supported=${info.supported}, smooth=${info.smooth}, powerEfficient=${info.powerEfficient}`);
      } catch (err) {
        results.push({ name: item.name, supported: false, smooth: false, powerEfficient: false, error: errInfo(err).message });
        this._addLog('error', `encodingInfo("${item.name}") 异常：${errInfo(err).message}`);
      }
    }
    this.setState({ encodeResults: results });
  }

  // ===================== Card 4: EME + Text Tracks =====================

  _detectEME() {
    const supported = typeof navigator !== 'undefined' && typeof navigator.requestMediaKeySystemAccess === 'function';
    this.setState({
      emeSupported: supported,
      logs: [...this.state.logs, {
        type: 'eme',
        content: supported
          ? 'navigator.requestMediaKeySystemAccess 可用（EME）'
          : 'EME 不可用（typeof navigator.requestMediaKeySystemAccess === "undefined"）',
        time: formatTime(),
      }].slice(-40),
    });
  }

  async _probeKeySystems() {
    if (!this.state.emeSupported) {
      this._addLog('error', 'EME 不可用，无法检测 keySystem');
      return;
    }
    const configs = [{
      initDataTypes: ['cenc'],
      audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
      videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
      distinctiveIdentifier: 'optional',
      persistentState: 'optional',
      sessionTypes: ['temporary'],
    }];
    const results = [];
    for (const ks of EME_KEY_SYSTEMS) {
      try {
        const access = await navigator.requestMediaKeySystemAccess(ks, configs);
        const cfg = access.getConfiguration();
        results.push({
          keySystem: ks, supported: true,
          detail: `initDataTypes=${cfg.initDataTypes?.join(',') || '—'} · sessionTypes=${cfg.sessionTypes?.join(',') || '—'}`,
        });
        this._addLog('eme', `requestMediaKeySystemAccess("${ks}") ✓ → getConfiguration() 可读`);
      } catch (err) {
        results.push({ keySystem: ks, supported: false, detail: errInfo(err).message });
        this._addLog('error', `requestMediaKeySystemAccess("${ks}") 失败：${errInfo(err).message}`);
      }
    }
    this.setState({ emeResults: results });
  }

  async _createMediaKeys() {
    if (!this.state.emeSupported) { this._addLog('error', 'EME 不可用'); return; }
    try {
      const access = await navigator.requestMediaKeySystemAccess('org.w3.clearkey', [{
        initDataTypes: ['cenc'],
        audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
        videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
        sessionTypes: ['temporary'],
      }]);
      const mediaKeys = await access.createMediaKeys();
      this._mediaKeys = mediaKeys;
      this._addLog('eme', `createMediaKeys() ✓ · keySystem=org.w3.clearkey`);
      // createSession('temporary')
      const session = mediaKeys.createSession('temporary');
      this._keySession = session;
      this.on(session, 'message', (e) => this._addLog('eme', `MediaKeySession.message：messageType=${e.messageType}, ${e.message?.byteLength || 0} bytes`));
      this.on(session, 'keystatuseschange', () => this._addLog('eme', 'MediaKeySession.keystatuseschange'));
      this._addLog('eme', `createSession("temporary") ✓ · sessionId=${session.sessionId || '(empty)'}`);
      // setMediaKeys 绑定到 video 元素
      const v = this._videoEl;
      if (v && typeof v.setMediaKeys === 'function') {
        await v.setMediaKeys(mediaKeys);
        this._addLog('eme', `HTMLMediaElement.setMediaKeys(mediaKeys) ✓`);
      } else {
        this._addLog('info', 'video.setMediaKeys 不可用，跳过绑定');
      }
    } catch (err) {
      this._addLog('error', `createMediaKeys 链路失败：${errInfo(err).message}`);
    }
  }

  _addTextTrack() {
    const v = this._trackVideoEl;
    if (!v) { this._addLog('error', '未找到字幕视频元素'); return; }
    if (typeof v.addTextTrack !== 'function') {
      this._addLog('error', 'HTMLMediaElement.addTextTrack 不可用');
      return;
    }
    // addTextTrack(kind, label, language)
    const track = v.addTextTrack('subtitles', '中文字幕', 'zh-CN');
    if (!track) { this._addLog('error', 'addTextTrack 返回空值，无法创建 TextTrack'); return; }
    track.mode = 'showing'; // 'disabled' | 'hidden' | 'showing'
    for (const c of SAMPLE_CUES) {
      const cue = new VTTCue(c.start, c.end, c.text);
      cue.line = 'auto'; cue.position = 50; cue.size = 100; cue.align = 'center';
      track.addCue(cue);
    }
    this._addLog('eme', `addTextTrack("subtitles","中文字幕","zh-CN") ✓ mode=showing · addCue ${SAMPLE_CUES.length} 个 VTTCue`);
    // 监听 cuechange
    this.on(track, 'cuechange', () => {
      const active = track.activeCues?.length ? [...track.activeCues].map((c) => c.text).join(' / ') : '（无）';
      this._addLog('eme', `TextTrack.cuechange · activeCues: ${active}`);
    });
    this._refreshTextTracks();
  }

  _refreshTextTracks() {
    const v = this._trackVideoEl;
    if (!v) return;
    const list = [];
    for (let i = 0; i < v.textTracks.length; i++) {
      const t = v.textTracks[i];
      const cues = [];
      for (let j = 0; j < t.cues.length; j++) {
        const c = t.cues[j];
        cues.push({ start: c.startTime, end: c.endTime, text: c.text });
      }
      list.push({ kind: t.kind, label: t.label, language: t.language, mode: t.mode, cues });
    }
    this.setState({ textTracksList: list, vttCues: list[0]?.cues || [] });
  }

  _toggleTrackMode() {
    const v = this._trackVideoEl;
    if (!v || v.textTracks.length === 0) { this._addLog('error', '尚未添加 TextTrack'); return; }
    const t = v.textTracks[0];
    t.mode = t.mode === 'showing' ? 'hidden' : 'showing';
    this._addLog('eme', `TextTrack.mode → ${t.mode}`);
    this._refreshTextTracks();
  }

  _removeFirstCue() {
    const v = this._trackVideoEl;
    if (!v || v.textTracks.length === 0 || v.textTracks[0].cues.length === 0) {
      this._addLog('error', '没有可移除的 VTTCue');
      return;
    }
    const t = v.textTracks[0];
    t.removeCue(t.cues[0]);
    this._addLog('eme', `TextTrack.removeCue ✓ · 剩余 ${t.cues.length} 个 cue`);
    this._refreshTextTracks();
  }

  // ===================== Card 5: MediaStreamTrack + Insertable Streams =====================

  _detectTrack() {
    const trackSupported = typeof MediaStreamTrack !== 'undefined';
    const generatorSupported = typeof MediaStreamTrackGenerator !== 'undefined';
    this.setState({
      trackSupported,
      generatorSupported,
      trackInfo: trackSupported
        ? 'MediaStreamTrack 可用（kind / id / label / enabled / muted / readyState / getCapabilities / getConstraints / applyConstraints / clone / stop · 事件 unmute / mute / ended / overconstrained）'
        : 'MediaStreamTrack 不可用（typeof MediaStreamTrack === "undefined"）',
      logs: [...this.state.logs, {
        type: 'track',
        content: `MediaStreamTrack: ${trackSupported ? '可用' : '不可用'}；MediaStreamTrackGenerator(Insertable Streams): ${generatorSupported ? '可用' : '不可用'}`,
        time: formatTime(),
      }].slice(-40),
    });
  }

  async _getUserMedia() {
    if (!navigator?.mediaDevices?.getUserMedia) {
      this._addLog('error', 'navigator.mediaDevices.getUserMedia 不可用（jsdom / 非 HTTPS / 无设备）');
      return;
    }
    try {
      this._addLog('info', 'getUserMedia({ video: true, audio: false }) 请求中（需用户授权）…');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      this._mediaStream = stream;
      const track = stream.getVideoTracks()[0];
      this._streamTrack = track;
      if (!track) { this._addLog('error', 'getUserMedia 返回的 stream 中没有 video track'); return; }
      // 监听 track 事件
      this.on(track, 'unmute', () => this._addLog('track', 'MediaStreamTrack.unmute'));
      this.on(track, 'mute', () => this._addLog('track', 'MediaStreamTrack.mute'));
      this.on(track, 'ended', () => this._addLog('track', `MediaStreamTrack.ended · readyState=${track.readyState}`));
      // 展示属性
      const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
      const cons = typeof track.getConstraints === 'function' ? track.getConstraints() : {};
      const info = [
        `kind = ${track.kind}`,
        `id = ${track.id}`,
        `label = ${track.label || '(empty)'}`,
        `enabled = ${track.enabled}`,
        `muted = ${track.muted}`,
        `readyState = ${track.readyState}`,
        `getCapabilities() = ${JSON.stringify(caps).slice(0, 200)}`,
        `getConstraints() = ${JSON.stringify(cons)}`,
      ].join('\n');
      this.setState({ trackInfo: info });
      this._addLog('track', `getUserMedia ✓ · track.kind=${track.kind}, readyState=${track.readyState}, label="${track.label || ''}"`);
      // 把流挂到视频元素上预览
      if (this._videoEl && this._videoEl.srcObject !== undefined) {
        this._videoEl.srcObject = stream;
        this._addLog('info', '已将 MediaStream 挂到 video.srcObject（预览）');
      }
    } catch (err) {
      this._addLog('error', `getUserMedia 失败：${errInfo(err).name || ''} ${errInfo(err).message}`);
    }
  }

  _applyConstraints() {
    const track = this._streamTrack;
    if (!track) { this._addLog('error', '尚无 MediaStreamTrack，先点 getUserMedia'); return; }
    if (typeof track.applyConstraints !== 'function') { this._addLog('error', 'track.applyConstraints 不可用'); return; }
    const constraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } };
    track.applyConstraints(constraints)
      .then(() => this._addLog('track', `applyConstraints ✓ ${JSON.stringify(constraints)}`))
      .catch((err) => this._addLog('error', `applyConstraints 失败：${errInfo(err).message}`));
  }

  _cloneTrack() {
    const track = this._streamTrack;
    if (!track) { this._addLog('error', '尚无 MediaStreamTrack，先点 getUserMedia'); return; }
    if (typeof track.clone !== 'function') { this._addLog('error', 'track.clone 不可用'); return; }
    const cloned = track.clone();
    this._addLog('track', `track.clone() ✓ · 新 id=${cloned.id}, readyState=${cloned.readyState}`);
    try { cloned.stop(); } catch { /* noop */ }
  }

  _stopTrack() {
    const track = this._streamTrack;
    if (!track) { this._addLog('error', '尚无 MediaStreamTrack，先点 getUserMedia'); return; }
    try { track.stop(); this._addLog('track', `track.stop() ✓ · readyState=${track.readyState}`); }
    catch (err) { this._addLog('error', `track.stop 失败：${errInfo(err).message}`); }
  }

  _probeGenerator() {
    if (!this.state.generatorSupported) {
      this._addLog('error', 'MediaStreamTrackGenerator 不可用（Insertable Streams API 未实现）');
      return;
    }
    try {
      // MediaStreamTrackGenerator({ kind }) 创建可写入帧的 track
      const gen = new MediaStreamTrackGenerator({ kind: 'video' });
      this._addLog('track', `new MediaStreamTrackGenerator({ kind: 'video' }) ✓ · writableStream=${!!gen.writable}`);
      // MediaStreamTrackProcessor({ track }) 用于读取视频帧
      if (typeof MediaStreamTrackProcessor !== 'undefined') {
        const proc = new MediaStreamTrackProcessor({ track: gen });
        this._addLog('track', `new MediaStreamTrackProcessor({ track }) ✓ · readableStream=${!!proc.readable}`);
      } else {
        this._addLog('info', 'MediaStreamTrackProcessor 不可用（仅 Generator 可用）');
      }
      try { gen.stop(); } catch { /* noop */ }
    } catch (err) {
      this._addLog('error', `MediaStreamTrackGenerator 异常：${errInfo(err).message}`);
    }
  }

  // ===================== 日志面板 + 表格辅助 =====================

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

  _renderCapabilitiesTable(rows) {
    if (!rows || rows.length === 0) return h('div', { class: 'log-panel__empty' }, '（点击上方按钮运行检测）');
    const TH = { padding: '6px 10px', borderBottom: '1px solid var(--color-border, #eee)', textAlign: 'left', fontSize: '12px' };
    const TD = { padding: '6px 10px', borderBottom: '1px solid var(--color-border, #f0f0f0)', fontSize: '12px' };
    const tagFor = (v) => v ? h(Tag, { color: 'success' }, '是') : h(Tag, { color: 'error' }, '否');
    return h('table', { style: { width: '100%', borderCollapse: 'collapse' } },
      h('thead', {}, h('tr', {},
        h('th', { style: TH }, '配置'),
        h('th', { style: TH }, 'supported'),
        h('th', { style: TH }, 'smooth'),
        h('th', { style: TH }, 'powerEfficient'),
      )),
      h('tbody', {},
        ...rows.map((r) => h('tr', {},
          h('td', { style: TD }, r.name),
          h('td', { style: TD }, r.error ? h(Tag, { color: 'error' }, 'err') : tagFor(r.supported)),
          h('td', { style: TD }, r.error ? '—' : tagFor(r.smooth)),
          h('td', { style: TD }, r.error ? '—' : tagFor(r.powerEfficient)),
        )),
      ),
    );
  }

  // ===================== 渲染 =====================

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, '媒体扩展与高级特性实验室'),

      h(Alert, {
        type: 'info',
        message: 'MediaSource · Picture-in-Picture · Document PiP · Media Capabilities · EME · Text Tracks · MediaStreamTrack · Insertable Streams',
        description: '本页演示 HTML 媒体扩展全家桶。MediaSource / PiP / MediaCapabilities / EME / MediaStreamTrackGenerator 大多在 jsdom 中不可用，所有调用前均做 typeof / in 检测，不可用时记日志说明。MediaSource 与 PiP 的 video 元素需要真实视频数据或用户手势方可生效。',
      }),

      // ============ Card 1: Media Source Extensions ============
      h(Card, {
        title: '1. Media Source Extensions（MSE）',
        extra: h(Tag, { color: s.mseSupported === null ? 'default' : (s.mseSupported ? 'success' : 'error') },
          s.mseSupported === null ? '检测中' : (s.mseSupported ? '稳定' : '不可用')),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'new MediaSource() → addSourceBuffer(mime) → SourceBuffer.mode（segments|sequence）/ appendBuffer / remove / abort。SourceBufferList 事件 addsourcebuffer / removesourcebuffer。URL.createObjectURL(mediaSource) 生成 video.src。MediaSource.isTypeSupported(mime) 静态检测。endOfStream() 标记流结束。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('创建 MediaSource', { type: 'primary', size: 'sm', onClick: () => this._createMSE() }),
            this._btn('sourceBuffer.abort', { size: 'sm', onClick: () => this._mseAbort() }),
            this._btn('sourceBuffer.remove(0,1)', { size: 'sm', onClick: () => this._mseRemove() }),
            this._btn('endOfStream', { size: 'sm', danger: true, onClick: () => this._mseEndOfStream() }),
          ),
          h('div', { class: 'flex items-center gap-sm' },
            h('span', { class: 'fs-sm' }, '状态：'),
            h(Tag, { color: s.mseStatus === '未创建' ? 'default' : 'primary' }, s.mseStatus),
          ),
          h('video', { class: 'mse-video', controls: true, muted: true, playsInline: true,
            style: { width: '100%', maxWidth: '480px', background: '#000', borderRadius: '6px' } }),
          s.mimeResults.length > 0
            ? h('div', {},
                h('div', { class: 'fs-sm text-secondary mb-xs' }, 'MediaSource.isTypeSupported() 检测结果：'),
                h('div', { class: 'flex flex-col gap-xs' },
                  ...s.mimeResults.map((r) => h('div', { class: 'flex items-center gap-sm fs-sm' },
                    h(Tag, { color: r.ok ? 'success' : 'error' }, r.ok ? '✓' : '✕'),
                    h('code', { class: 'fs-sm' }, r.mime),
                  )),
                ),
              )
            : h('div', { class: 'log-panel__empty' }, '（不可用时无检测结果）'),
        ),
      ),

      // ============ Card 2: Picture-in-Picture ============
      h(Card, {
        title: '2. Picture-in-Picture 与 Document PiP',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: s.pipSupported ? 'success' : 'error' }, s.pipSupported ? 'PiP' : 'PiP 不可用'),
          h(Tag, { color: s.docPipSupported ? 'warning' : 'error' }, s.docPipSupported ? 'Doc PiP 实验' : 'Doc PiP 不可用'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'HTMLVideoElement.requestPictureInPicture() → Promise<PictureInPictureWindow>；document.pictureInPictureElement 当前 PiP 元素；document.exitPictureInPicture() 退出。事件 enterpictureinpicture / leavepictureinpicture / resize。Document PiP：window.documentPictureInPicture.requestWindow({width,height}) → Window，可把任意 DOM 移过去。能力检测：\'pictureInPictureEnabled\' in document / \'documentPictureInPicture\' in window。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('请求 PiP', { type: 'primary', size: 'sm', onClick: () => this._requestPiP(), disabled: !s.pipSupported }),
            this._btn('退出 PiP', { size: 'sm', onClick: () => this._exitPiP(), disabled: !s.pipActive }),
            this._btn('请求 Document PiP', { type: 'primary', size: 'sm', onClick: () => this._requestDocPiP(), disabled: !s.docPipSupported }),
            this._btn('关闭 Doc PiP 窗口', { size: 'sm', danger: true, onClick: () => this._closeDocPiP(), disabled: !s.docPipActive }),
          ),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            h('span', { class: 'fs-sm' }, 'PiP 状态：'),
            h(Tag, { color: s.pipActive ? 'success' : 'default' }, s.pipActive ? '运行中' : '未运行'),
            s.pipWindowSize && h('span', { class: 'fs-sm text-secondary' }, `window=${s.pipWindowSize}`),
            h('span', { class: 'fs-sm' }, 'Doc PiP：'),
            h(Tag, { color: s.docPipActive ? 'success' : 'default' }, s.docPipActive ? '已打开' : '未打开'),
          ),
          h('div', { class: 'doc-pip-content', style: { padding: '12px', background: 'var(--color-fill, #f5f5f5)', borderRadius: '6px' } },
            h('div', { class: 'fw-medium mb-xs' }, '★ 我是会被转移到 Document PiP 窗口的 DOM 节点'),
            h('div', { class: 'fs-sm text-secondary' }, '点击"请求 Document PiP"后，本 div 会被 appendChild 到 PiP 窗口的 document.body；关闭窗口时通过 pagehide 事件移回原位置。'),
          ),
        ),
      ),

      // ============ Card 3: Media Capabilities ============
      h(Card, {
        title: '3. Media Capabilities API',
        extra: h(Tag, { color: s.mcSupported === null ? 'default' : (s.mcSupported ? 'success' : 'error') },
          s.mcSupported === null ? '检测中' : (s.mcSupported ? '稳定' : '不可用')),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'navigator.mediaCapabilities.decodingInfo({type, video, audio}) → {supported, smooth, powerEfficient}；type: \'file\' | \'media-source\'。encodingInfo({type, video, audio}) → 同结构；type: \'record\' | \'webrtc\'。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('运行 decodingInfo', { type: 'primary', size: 'sm', onClick: () => this._runDecodeInfo(), disabled: !s.mcSupported }),
            this._btn('运行 encodingInfo', { type: 'primary', size: 'sm', onClick: () => this._runEncodeInfo(), disabled: !s.mcSupported }),
          ),
          h('div', {},
            h('div', { class: 'fs-sm text-secondary mb-xs' }, 'decodingInfo 结果：'),
            this._renderCapabilitiesTable(s.decodeResults),
          ),
          h('div', {},
            h('div', { class: 'fs-sm text-secondary mb-xs' }, 'encodingInfo 结果：'),
            this._renderCapabilitiesTable(s.encodeResults),
          ),
        ),
      ),

      // ============ Card 4: EME + Text Tracks ============
      h(Card, {
        title: '4. Encrypted Media Extensions (EME) 与 Text Tracks',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: s.emeSupported ? 'success' : 'error' }, s.emeSupported ? 'EME' : 'EME 不可用'),
          h(Tag, { color: 'success' }, 'Text Tracks'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'EME：navigator.requestMediaKeySystemAccess(keySystem, configs) → MediaKeySystemAccess；getConfiguration() / createMediaKeys()；MediaKeys.createSession(\'temporary\')；MediaKeySession.generateRequest / update / close / load；HTMLMediaElement.setMediaKeys(mediaKeys)。Text Tracks：HTMLMediaElement.textTracks、addTextTrack(kind,label,lang)；TextTrack.kind/label/language/mode/cues/addCue/removeCue；VTTCue.startTime/endTime/text/line/position/size/align。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('探测 keySystem', { type: 'primary', size: 'sm', onClick: () => this._probeKeySystems(), disabled: !s.emeSupported }),
            this._btn('createMediaKeys + setMediaKeys', { size: 'sm', onClick: () => this._createMediaKeys(), disabled: !s.emeSupported }),
            this._btn('addTextTrack + VTTCue', { type: 'primary', size: 'sm', onClick: () => this._addTextTrack() }),
            this._btn('切换 mode', { size: 'sm', onClick: () => this._toggleTrackMode() }),
            this._btn('removeCue(0)', { size: 'sm', danger: true, onClick: () => this._removeFirstCue() }),
          ),
          s.emeResults.length > 0
            ? h('div', {},
                h('div', { class: 'fs-sm text-secondary mb-xs' }, 'requestMediaKeySystemAccess 探测结果：'),
                h('div', { class: 'flex flex-col gap-xs' },
                  ...s.emeResults.map((r) => h('div', { class: 'flex items-start gap-sm fs-sm' },
                    h(Tag, { color: r.supported ? 'success' : 'error' }, r.supported ? '✓' : '✕'),
                    h('div', {},
                      h('code', { class: 'fw-medium' }, r.keySystem),
                      h('div', { class: 'fs-sm text-tertiary' }, r.detail),
                    ),
                  )),
                ),
              )
            : null,
          h('video', { class: 'track-video', controls: true, muted: true, playsInline: true,
            style: { width: '100%', maxWidth: '480px', background: '#000', borderRadius: '6px' } }),
          s.textTracksList.length > 0
            ? h('div', {},
                h('div', { class: 'fs-sm text-secondary mb-xs' }, 'TextTracks 列表：'),
                ...s.textTracksList.map((t) => h('div', { class: 'fs-sm mb-xs', style: { padding: '6px 10px', background: 'var(--color-fill, #f5f5f5)', borderRadius: '4px' } },
                  h('strong', {}, `${t.kind}`),
                  h('span', { class: 'text-secondary' }, ` · label="${t.label}" · lang=${t.language} · `),
                  h(Tag, { color: t.mode === 'showing' ? 'success' : (t.mode === 'hidden' ? 'warning' : 'default') }, t.mode),
                  h('span', { class: 'text-secondary' }, ` · cues=${t.cues.length}`),
                )),
              )
            : null,
          s.vttCues.length > 0
            ? h('div', {},
                h('div', { class: 'fs-sm text-secondary mb-xs' }, 'VTTCue 内容：'),
                h('div', { class: 'flex flex-col gap-xs' },
                  ...s.vttCues.map((c) => h('div', { class: 'fs-sm', style: { padding: '4px 8px', background: 'var(--color-fill, #f5f5f5)', borderRadius: '4px' } },
                    h('span', { class: 'text-tertiary' }, `[${c.start.toFixed(1)}→${c.end.toFixed(1)}] `),
                    h('span', {}, c.text),
                  )),
                ),
              )
            : null,
        ),
      ),

      // ============ Card 5: MediaStreamTrack + Insertable Streams ============
      h(Card, {
        title: '5. MediaStreamTrack 深入与 Insertable Streams',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: s.trackSupported ? 'success' : 'error' }, s.trackSupported ? 'Track' : 'Track 不可用'),
          h(Tag, { color: s.generatorSupported ? 'warning' : 'error' }, s.generatorSupported ? 'Generator 实验' : 'Generator 不可用'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'MediaStreamTrack 属性：kind / id / label / enabled / muted / readyState（live|ended）；getCapabilities() / getConstraints() / applyConstraints() / clone() / stop()；事件 unmute / mute / ended / overconstrained。Insertable Streams：MediaStreamTrackGenerator({kind}) 创建可写帧的 track；MediaStreamTrackProcessor({track}) 读取视频帧（readable stream）。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('getUserMedia({video:true})', { type: 'primary', size: 'sm', onClick: () => this._getUserMedia(), disabled: !s.trackSupported }),
            this._btn('applyConstraints', { size: 'sm', onClick: () => this._applyConstraints(), disabled: !s.trackSupported }),
            this._btn('clone', { size: 'sm', onClick: () => this._cloneTrack(), disabled: !s.trackSupported }),
            this._btn('stop', { size: 'sm', danger: true, onClick: () => this._stopTrack(), disabled: !s.trackSupported }),
            this._btn('探测 Generator/Processor', { size: 'sm', onClick: () => this._probeGenerator(), disabled: !s.generatorSupported }),
          ),
          s.trackInfo
            ? h('pre', { class: 'code-block' }, s.trackInfo)
            : h('div', { class: 'log-panel__empty' }, '（点击 getUserMedia 获取 track 信息）'),
          h(Alert, {
            type: 'warning',
            message: 'Insertable Streams API 用途',
            description: 'MediaStreamTrackGenerator + MediaStreamTrackProcessor 允许在 WebCodecs 与 WebRTC / MediaRecorder 之间以流式方式传输原始视频帧（VideoFrame），可用于实时 AI 处理、滤镜、转码等场景。该 API 当前为实验性，仅 Chromium 系实现。',
          }),
        ),
      ),

      // ============ 日志面板 ============
      h(Card, {
        title: '事件日志',
        extra: h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      },
        this._renderLogPanel(),
      ),
    ];
  }
}
