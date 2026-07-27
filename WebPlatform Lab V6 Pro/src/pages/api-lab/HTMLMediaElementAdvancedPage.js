// =====================================================================
// HTMLMediaElementAdvancedPage.js —— HTMLMediaElement 高级特性深度实验室
// 演示 MDN（HTMLMediaElement 进阶能力，与 AdvancedMediaPage 互补，本页专注
// 媒体元素自身的「输出设备 / 变速不变调 / 控件禁用 / 远端播放 / 多轨道 / 时间区间」）：
//   1. setSinkId 与 audioSink（输出设备选择，HTMLMediaElement.setSinkId(deviceId)
//      / audioSink 属性 / sinkchange 事件 / 配合 navigator.mediaDevices.enumerateDevices()
//      过滤 audiooutput / Chrome 110+ / 权限模型）
//   2. preservesPitch 变速不变调（playbackRate + preservesPitch: true|false
//      / webkitPreservesPitch / mozPreservesPitch / SoundTouch 算法 / DJ/语言学习）
//   3. controlsList 精细控件（controlsList="nodownload nofullscreen noplaybackrate
//      noremoteplayback" / disablePictureInPicture 属性 / Chrome 58+ / DOMTokenList）
//   4. disableRemotePlayback 与 RemotePlayback（remote 属性 / RemotePlayback API
//      / state: connecting/connected/disconnected / watchAvailability
//      / disableRemotePlayback 禁用 / AirPlay/Chromecast / 与 Presentation API 区别）
//   5. audioTracks/videoTracks 多轨道（AudioTrackList/VideoTrackList
//      / AudioTrack.enabled / VideoTrack.selected / change 事件 / 字幕配音视角切换
//      / Safari 支持领先 / Chrome 需多轨道容器）
//   6. seekable/played/buffered 与媒体事件（TimeRanges 接口 / start/end/length
//      / seeking/seeked/waiting/canplay/stalled/progress/loadedmetadata/ended
//      / 缓冲策略 / preload 三态）
//   7. 接口总览（HTMLMediaElement 与 HTMLAudioElement/HTMLVideoElement 继承关系
//      / 属性/方法/事件分类 / 浏览器支持矩阵）
//   8. 实战与陷阱（多语言播放器：audioTracks 切配音 + setSinkId 选设备
//      + controlsList 隐藏下载 + preservesPitch 变速 / tracks 浏览器差异
//      / iOS 限制 / 无障碍字幕同步）
// 说明：setSinkId/audioSink/audioTracks/videoTracks/RemotePlayback 在 jsdom 中
//       均不可用，所有 API 调用前做 typeof / in 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)）并设置 info 文本，绝不抛异常。真实浏览器
//       （Chrome/Edge 110+）可完整体验，Safari 对 audioTracks 支持领先。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// ===================== 模块级常量 =====================

const SUPPORT_MATRIX = [
  { browser: 'Chrome/Edge 110+', setSinkId: true, audioSink: true, preservesPitch: true, controlsList: true, remote: true, audioTracks: 'partial', videoTracks: 'partial' },
  { browser: 'Chrome/Edge <110', setSinkId: true, audioSink: false, preservesPitch: true, controlsList: true, remote: true, audioTracks: 'partial', videoTracks: 'partial' },
  { browser: 'Safari 17+', setSinkId: false, audioSink: false, preservesPitch: true, controlsList: 'partial', remote: 'AirPlay', audioTracks: true, videoTracks: true },
  { browser: 'Firefox', setSinkId: false, audioSink: false, preservesPitch: 'moz', controlsList: false, remote: false, audioTracks: false, videoTracks: false },
  { browser: 'iOS Safari', setSinkId: false, audioSink: false, preservesPitch: true, controlsList: 'partial', remote: 'AirPlay', audioTracks: true, videoTracks: true },
];

const CONTROLS_LIST_TOKENS = ['nodownload', 'nofullscreen', 'noplaybackrate', 'noremoteplayback'];

const MEDIA_EVENTS = [
  'loadstart', 'progress', 'suspend', 'abort', 'error', 'emptied', 'stalled',
  'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'playing', 'waiting',
  'seeking', 'seeked', 'ended', 'durationchange', 'timeupdate', 'play', 'pause',
  'ratechange', 'resize', 'volumechange',
];

export class HTMLMediaElementAdvancedPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',   // Card 1：接口总览与浏览器支持矩阵
      sinkInfo: '',       // Card 2：setSinkId 与 audioSink
      pitchInfo: '',      // Card 3：preservesPitch 变速不变调
      controlsInfo: '',   // Card 4：controlsList 精细控件
      remoteInfo: '',     // Card 5：disableRemotePlayback 与 RemotePlayback
      tracksInfo: '',     // Card 6：audioTracks/videoTracks 多轨道
      rangesInfo: '',     // Card 7：seekable/played/buffered 与媒体事件
      patternInfo: '',    // Card 8：实战与陷阱
      audioSessionInfo: '', // Card 9：AudioSession API 音频会话
    };
  }

  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];
    this._mediaEls = []; // 收集所有创建的媒体元素，便于卸载时清理

    this._initRefs();

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `setSinkId ${c(f.setSinkId)}`,
      `audioSink ${c(f.audioSink)}`,
      `preservesPitch ${c(f.preservesPitch)}`,
      `controlsList ${c(f.controlsList)}`,
      `disableRemotePlayback ${c(f.disableRemotePlayback)}`,
      `audioTracks ${c(f.audioTracks)}`,
      `videoTracks ${c(f.videoTracks)}`,
      `RemotePlayback ${c(f.remotePlayback)}`,
    ];

    const any = f.setSinkId || f.audioSink || f.preservesPitch || f.controlsList
      || f.disableRemotePlayback || f.audioTracks || f.videoTracks || f.remotePlayback;
    const summary = any
      ? `HTMLMediaElement 高级特性能力检测：${parts.join(' · ')}。当前环境部分支持，真实浏览器（Chrome/Edge 110+）可完整体验 setSinkId/audioSink，Safari 对 audioTracks/videoTracks 支持领先。`
      : `HTMLMediaElement 高级特性能力检测：${parts.join(' · ')}。jsdom/Node 环境无 setSinkId/audioSink/audioTracks/RemotePlayback，所有按钮点击仅记日志说明，不会抛异常；真实浏览器（Chrome/Edge 110+）可完整体验。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.setSinkId) this._addLog('warn', 'setSinkId 不可用（jsdom 无，Chrome/Edge 110+ 支持，Safari/Firefox 不支持）');
    if (!f.audioSink) this._addLog('warn', 'audioSink 属性不可用（Chrome 110+ 实验性，替代 setSinkId）');
    if (!f.preservesPitch) this._addLog('warn', 'preservesPitch 不可用（jsdom 无，主流浏览器支持，旧版需 webkit/moz 前缀）');
    if (!f.controlsList) this._addLog('warn', 'controlsList 不可用（Chrome 58+，Safari 部分，Firefox 不支持）');
    if (!f.disableRemotePlayback) this._addLog('warn', 'disableRemotePlayback 不可用（Chrome/Safari 支持，Firefox 不支持）');
    if (!f.audioTracks) this._addLog('warn', 'audioTracks 不可用（Safari 领先，Chrome 需多轨道容器，Firefox 不支持）');
    if (!f.videoTracks) this._addLog('warn', 'videoTracks 不可用（Safari 领先，Chrome 部分支持）');
    if (!f.remotePlayback) this._addLog('warn', 'RemotePlayback 不可用（Chrome/Edge 支持，Safari 用 webkit- 前缀 AirPlay）');
    if (!f.audioSession) this._addLog('warn', 'navigator.audioSession 不可用（Safari 17.4+，Chrome 开发中，jsdom 无音频会话概念）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 1. 暂停并清理所有媒体元素
    for (const el of this._mediaEls || []) {
      if (!el) continue;
      try { el.pause(); } catch { /* noop */ }
      try { el.removeAttribute('src'); } catch { /* noop */ }
      try { el.load(); } catch { /* noop */ }
    }
    this._mediaEls = [];
    // 2. 移除动态注入的样式
    for (const style of this._dynamicStyles || []) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 辅助方法 ——

  _initRefs() {
    // 媒体元素在 render 后由 _registerMediaEl 收集；此处仅做一次性能力检测准备
    this._audioSinkEl = this.$('.sink-audio');
    this._audioPitchEl = this.$('.pitch-audio');
    this._videoRemoteEl = this.$('.remote-video');
    this._audioTracksEl = this.$('.tracks-audio');
    this._audioRangesEl = this.$('.ranges-audio');
  }

  _registerMediaEl(el) {
    if (el && !this._mediaEls.includes(el)) this._mediaEls.push(el);
    return el;
  }

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
    this._injectStyle('hme-base', `
      .hme-demo {
        padding: 14px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .hme-device-list {
        margin-top: 10px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
      }
      .hme-device-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 12px;
      }
      .hme-device-item:last-child { border-bottom: none; }
      .hme-device-kind {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 8px;
        font-weight: 600;
      }
      .hme-device-kind--in { background: #dcfce7; color: #166534; }
      .hme-device-kind--out { background: #dbeafe; color: #1e40af; }
      .hme-device-kind--video { background: #fef3c7; color: #92400e; }
      .hme-device-label { font-weight: 600; color: #1e293b; flex: 1; }
      .hme-device-id { color: #64748b; font-family: monospace; font-size: 10px; }
      .hme-pitch-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        padding: 10px;
        background: #0f172a;
        border-radius: 6px;
        color: #e2e8f0;
        font-family: monospace;
        font-size: 12px;
      }
      .hme-pitch-meter {
        flex: 1;
        height: 8px;
        background: #334155;
        border-radius: 4px;
        overflow: hidden;
      }
      .hme-pitch-fill {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6);
        transition: width 0.2s ease;
      }
      .hme-cl-token {
        display: inline-block;
        padding: 2px 8px;
        margin: 2px;
        border-radius: 4px;
        font-size: 11px;
        font-family: monospace;
        background: #e0f2fe;
        color: #075985;
        border: 1px solid #bae6fd;
      }
      .hme-cl-token--on { background: #dcfce7; color: #166534; border-color: #86efac; }
      .hme-remote-state {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
      }
      .hme-remote-state--disconnected { background: #f1f5f9; color: #475569; }
      .hme-remote-state--connecting { background: #fef3c7; color: #92400e; }
      .hme-remote-state--connected { background: #dcfce7; color: #166534; }
      .hme-track-list {
        margin-top: 10px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
      }
      .hme-track-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 12px;
      }
      .hme-track-item:last-child { border-bottom: none; }
      .hme-track-kind {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 8px;
        font-weight: 600;
      }
      .hme-track-kind--audio { background: #dbeafe; color: #1e40af; }
      .hme-track-kind--video { background: #fce7f3; color: #9d174d; }
      .hme-ranges-bar {
        position: relative;
        height: 14px;
        background: #e2e8f0;
        border-radius: 4px;
        margin-top: 6px;
        overflow: hidden;
      }
      .hme-ranges-seg {
        position: absolute;
        top: 0;
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #60a5fa);
        border-radius: 4px;
      }
      .hme-ranges-seg--played { background: linear-gradient(90deg, #22c55e, #4ade80); }
      .hme-ranges-seg--seekable { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
      .hme-ranges-seg--buffered { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
      .hme-event-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 4px;
        margin-top: 8px;
      }
      .hme-event-cell {
        padding: 4px 6px;
        background: #f1f5f9;
        border-radius: 4px;
        font-size: 11px;
        font-family: monospace;
        text-align: center;
      }
      .hme-event-cell--fired { background: #dcfce7; color: #166534; font-weight: 600; }
      .hme-output {
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

  _flags() {
    const safe = (fn) => { try { return fn(); } catch { return false; } };
    const proto = (typeof HTMLMediaElement !== 'undefined' && HTMLMediaElement.prototype) || {};
    let audio = {};
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      try { audio = document.createElement('audio'); } catch { audio = {}; }
    }
    return {
      setSinkId: safe(() => typeof proto.setSinkId === 'function' || typeof audio.setSinkId === 'function'),
      audioSink: safe(() => 'audioSink' in proto || 'audioSink' in audio),
      preservesPitch: safe(() => 'preservesPitch' in proto || 'preservesPitch' in audio
        || 'webkitPreservesPitch' in audio || 'mozPreservesPitch' in audio),
      controlsList: safe(() => 'controlsList' in proto || 'controlsList' in audio),
      disableRemotePlayback: safe(() => 'disableRemotePlayback' in proto || 'disableRemotePlayback' in audio),
      audioTracks: safe(() => 'audioTracks' in proto || 'audioTracks' in audio),
      videoTracks: safe(() => 'videoTracks' in proto || 'videoTracks' in audio),
      remotePlayback: safe(() => 'RemotePlayback' in window || 'remote' in proto || 'remote' in audio
        || 'webkitRemotePlayback' in window),
      enumerateDevices: safe(() => typeof navigator !== 'undefined' && !!navigator.mediaDevices
        && typeof navigator.mediaDevices.enumerateDevices === 'function'),
      mediaDevices: safe(() => typeof navigator !== 'undefined' && !!navigator.mediaDevices),
      permissions: safe(() => typeof navigator !== 'undefined' && !!navigator.permissions),
      audioSession: safe(() => typeof navigator !== 'undefined' && 'audioSession' in navigator),
      audioSessionType: safe(() => typeof navigator !== 'undefined' && !!navigator.audioSession
        && typeof navigator.audioSession.type !== 'undefined'),
    };
  }

  // ===================== Card 1：接口总览 =====================

  _runOverviewDemo() {
    const f = this._flags();
    this._injectStyle('hme-overview-demo', `
      .hme-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
      .hme-matrix { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
      .hme-matrix th, .hme-matrix td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center; }
      .hme-matrix th { background: #f1f5f9; font-weight: 600; }
      .hme-matrix td.ok { background: #dcfce7; color: #166534; }
      .hme-matrix td.no { background: #fee2e2; color: #991b1b; }
      .hme-matrix td.partial { background: #fef3c7; color: #92400e; }
    `);
    const info = [
      '===== HTMLMediaElement 接口总览 =====',
      '',
      '【继承关系】',
      '  HTMLElement',
      '    └─ HTMLMediaElement（抽象基类，audio/video 共用）',
      '         ├─ HTMLAudioElement（<audio>，可直接 new Audio(url)）',
      '         └─ HTMLVideoElement（<video>，额外 width/height/poster/requestPictureInPicture）',
      '',
      '  // HTMLAudioElement 可直接构造',
      '  const a = new Audio("song.mp3");',
      '  // HTMLVideoElement 必须由 document.createElement 创建',
      '  const v = document.createElement("video");',
      '',
      '【核心属性分类】',
      '  播放控制：currentTime / duration / paused / ended / playbackRate / defaultPlaybackRate',
      '  音量：volume(0-1) / muted / defaultMuted',
      '  源：src / currentSrc / preload(none|metadata|auto) / autoplay / loop / crossOrigin',
      '  状态：readyState(HAVE_NOTHING..HAVE_ENOUGH_DATA) / networkState(EMPTY..NO_SOURCE)',
      '  缓冲：buffered / seekable / played（均返回 TimeRanges）',
      '  控件：controls / controlsList / disablePictureInPicture / disableRemotePlayback',
      '  变速：preservesPitch（默认 true）',
      '  输出：sinkId / audioSink（实验性）',
      '  轨道：audioTracks / videoTracks / textTracks / seekToNextFrame',
      '  远端：remote（RemotePlayback 对象，仅 video）',
      '  媒体键：mediaKeys（EME，见 AdvancedMediaPage）',
      '',
      '【核心方法分类】',
      '  播放：play() → Promise<void> / pause() / load() / canPlayType(type)',
      '  输出设备：setSinkId(deviceId) → Promise<void>（Chrome 110+）',
      '  PiP：requestPictureInPicture()（仅 HTMLVideoElement）',
      '  截帧：captureStream() / seekToNextFrame()',
      '  EME：setMediaKeys(mediaKeys)',
      '  快捷：fastSeek(time)（仅 Safari）',
      '',
      '【核心事件分类】',
      '  加载：loadstart / loadedmetadata / loadeddata / progress / canplay / canplaythrough',
      '  播放：play / pause / playing / waiting / ended / timeupdate',
      '  寻址：seeking / seeked / durationchange / ratechange / resize',
      '  错误：error / abort / emptied / stalled / suspend',
      '  音量：volumechange',
      '  输出：sinkchange（setSinkId 切换设备后触发）',
      '  远端：connecting / connect / disconnect（RemotePlayback）',
      '',
      '【浏览器支持矩阵（真实环境）】',
      '  浏览器             setSinkId  audioSink  preservesPitch  controlsList  RemotePlayback  audioTracks  videoTracks',
      '  Chrome/Edge 110+   ✓          ✓          ✓               ✓             ✓               partial      partial',
      '  Chrome/Edge <110   ✓          ✗          ✓               ✓             ✓               partial      partial',
      '  Safari 17+         ✗          ✗          ✓               partial       AirPlay         ✓            ✓',
      '  Firefox            ✗          ✗          moz 前缀        ✗             ✗               ✗            ✗',
      '  iOS Safari         ✗          ✗          ✓               partial       AirPlay         ✓            ✓',
      '',
      '【当前环境实际能力检测】',
      `  setSinkId: ${f.setSinkId ? '✓' : '✗'}`,
      `  audioSink: ${f.audioSink ? '✓' : '✗'}`,
      `  preservesPitch: ${f.preservesPitch ? '✓' : '✗'}`,
      `  controlsList: ${f.controlsList ? '✓' : '✗'}`,
      `  disableRemotePlayback: ${f.disableRemotePlayback ? '✓' : '✗'}`,
      `  audioTracks: ${f.audioTracks ? '✓' : '✗'}`,
      `  videoTracks: ${f.videoTracks ? '✓' : '✗'}`,
      `  RemotePlayback: ${f.remotePlayback ? '✓' : '✗'}`,
      `  enumerateDevices: ${f.enumerateDevices ? '✓' : '✗'}`,
      '',
      '【canPlayType 返回值】',
      '  media.canPlayType(\'audio/mp3\')        // "probably" / "maybe" / ""',
      '  media.canPlayType(\'audio/ogg; codecs="vorbis"\')',
      '  - "probably"：很可能可播（含 codec 信息）',
      '  - "maybe"：类型可能可播（无 codec 细节）',
      '  - ""（空串）：确定不可播',
      '',
      '【readyState 四态】',
      '  HAVE_NOTHING(0)      无任何数据',
      '  HAVE_METADATA(1)     已有元数据（时长/尺寸）',
      '  HAVE_CURRENT_DATA(2) 已有当前帧数据',
      '  HAVE_FUTURE_DATA(3)  已有足够数据播放',
      '  HAVE_ENOUGH_DATA(4)  足够流畅播放',
      '',
      '【与 AdvancedMediaPage 的分工】',
      '  AdvancedMediaPage：MediaSource / PiP / MediaCapabilities / EME / TextTracks / MediaStreamTrack',
      '  本页（HTMLMediaElementAdvancedPage）：setSinkId / audioSink / preservesPitch /',
      '    controlsList / disableRemotePlayback / RemotePlayback / audioTracks / videoTracks /',
      '    seekable/played/buffered（聚焦媒体元素自身高级属性，不重复 MSE/EME）',
      '',
      '【资源】',
      '  - MDN HTMLMediaElement: https://developer.mozilla.org/docs/Web/API/HTMLMediaElement',
      '  - MDN setSinkId: https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/setSinkId',
      '  - MDN audioSink: https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/audioSink',
      '  - MDN preservesPitch: https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/preservesPitch',
      '  - MDN controlsList: https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/controlsList',
      '  - MDN RemotePlayback: https://developer.mozilla.org/docs/Web/API/RemotePlayback',
      '  - MDN AudioTrackList: https://developer.mozilla.org/docs/Web/API/AudioTrackList',
      '  - MDN TimeRanges: https://developer.mozilla.org/docs/Web/API/TimeRanges',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('info', `接口总览演示完成；setSinkId=${f.setSinkId}，audioTracks=${f.audioTracks}，RemotePlayback=${f.remotePlayback}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 接口总览 —— HTMLMediaElement 继承体系与浏览器支持矩阵',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['setSinkId', f.setSinkId],
          ['preservesPitch', f.preservesPitch],
          ['audioTracks', f.audioTracks],
        ]),
        h(Tag, { color: 'primary' }, '总览'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'HTMLMediaElement 是 HTMLAudioElement 与 HTMLVideoElement 的共同抽象基类。核心属性按「播放控制 / 音量 / 源 / 状态 / 缓冲 / 控件 / 变速 / 输出 / 轨道 / 远端」分类。canPlayType 返回 probably/maybe/空串。readyState 四态（HAVE_NOTHING..HAVE_ENOUGH_DATA）。本页聚焦 setSinkId/audioSink/preservesPitch/controlsList/disableRemotePlayback/RemotePlayback/audioTracks/videoTracks/seekable 等媒体元素自身高级特性，与 AdvancedMediaPage（MSE/EME/PiP）互补。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行接口总览演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// HTMLAudioElement 可直接构造，HTMLVideoElement 需 createElement
const a = new Audio('song.mp3');
const v = document.createElement('video');

// canPlayType 返回 probably / maybe / 空串
console.log(a.canPlayType('audio/mp3'));                 // "probably"
console.log(a.canPlayType('audio/ogg; codecs="vorbis"'));// "maybe" 或 ""

// readyState 四态
a.addEventListener('loadedmetadata', () => {
  console.log('readyState:', a.readyState);  // 1 = HAVE_METADATA
  console.log('duration:', a.duration);
});

// 能力检测（高级特性）
const caps = {
  setSinkId: typeof HTMLMediaElement.prototype.setSinkId === 'function',
  audioSink: 'audioSink' in HTMLMediaElement.prototype,
  preservesPitch: 'preservesPitch' in HTMLMediaElement.prototype,
  controlsList: 'controlsList' in HTMLMediaElement.prototype,
  audioTracks: 'audioTracks' in HTMLMediaElement.prototype,
  remotePlayback: 'RemotePlayback' in window,
};`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 HTMLMediaElement 接口总览与浏览器支持矩阵）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：setSinkId 与 audioSink =====================

  async _runSinkDemo() {
    const f = this._flags();
    this._injectStyle('hme-sink-demo', `
      .hme-sink-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const audio = this.$('.sink-audio');
    this._registerMediaEl(audio);

    // 真实路径：enumerateDevices → setSinkId
    if (f.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
        this._addLog('info', `enumerateDevices() 返回 ${devices.length} 个设备，audiooutput ${audioOutputs.length} 个`);
        const list = this.$('.hme-sink-list');
        if (list) {
          list.innerHTML = '';
          for (const d of audioOutputs) {
            const item = h('div', { class: 'hme-device-item' },
              h('span', { class: 'hme-device-kind hme-device-kind--out' }, 'audiooutput'),
              h('span', { class: 'hme-device-label' }, d.label || `设备 ${d.deviceId.slice(0, 8)}…`),
              h('span', { class: 'hme-device-id' }, d.deviceId.slice(0, 16)),
            );
            list.appendChild(item);
          }
          if (audioOutputs.length === 0) {
            list.appendChild(h('div', { class: 'hme-device-item' }, '（未发现 audiooutput 设备，可能需先授权麦克风）'));
          }
        }
      } catch (err) {
        this._addLog('warn', `enumerateDevices 失败：${err && err.message}（可能需 HTTPS + 麦克风权限）`);
      }
    } else {
      this._addLog('warn', 'navigator.mediaDevices.enumerateDevices 不可用（jsdom 无，真实浏览器需 HTTPS/localhost + 权限）');
    }

    // 真实 setSinkId 调用
    if (f.setSinkId && audio) {
      try {
        // 取第一个非默认 audiooutput 设备的 deviceId（演示用）
        let targetId = '';
        if (f.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const outs = devices.filter((d) => d.kind === 'audiooutput');
          if (outs.length > 1) targetId = outs[1].deviceId;
        }
        if (targetId) {
          await audio.setSinkId(targetId);
          this._addLog('info', `setSinkId("${targetId.slice(0, 12)}…") ✓ 已切换输出设备`);
        } else {
          this._addLog('warn', '仅有默认输出设备，setSinkId 演示需多设备环境（插入耳机/蓝牙音箱可见效果）');
        }
      } catch (err) {
        this._addLog('warn', `setSinkId 失败：${err && err.message}（部分浏览器需 SecureContext + 用户激活）`);
      }
    } else if (!f.setSinkId) {
      this._addLog('warn', 'setSinkId 不可用，跳过真实切换（jsdom 无，Chrome/Edge 110+ 支持）');
    }

    // audioSink 属性演示（实验性，替代 setSinkId）
    if (f.audioSink && audio) {
      try {
        const old = audio.audioSink;
        this._addLog('info', `audioSink 属性当前值：${JSON.stringify(old)}（设为 deviceId 即可切换，无需 await）`);
      } catch (err) {
        this._addLog('warn', `audioSink 读取失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'audioSink 属性不可用（Chrome 110+ 实验性，逐步替代 setSinkId）');
    }

    const info = [
      '===== setSinkId 与 audioSink 输出设备选择 =====',
      '',
      '【setSinkId(deviceId) —— 切换输出设备】',
      '  // 1. 枚举所有媒体设备',
      '  const devices = await navigator.mediaDevices.enumerateDevices();',
      '  // 2. 过滤音频输出设备',
      '  const audioOutputs = devices.filter(d => d.kind === "audiooutput");',
      '  // 3. 切换 <audio>/<video> 的输出到指定设备',
      '  await audioElement.setSinkId(audioOutputs[0].deviceId);',
      '  // 4. 监听 sinkchange 事件',
      '  audioElement.addEventListener("sinkchange", () => {',
      '    console.log("输出设备已切换，当前 sinkId:", audioElement.sinkId);',
      '  });',
      '',
      '【返回值与异常】',
      '  setSinkId(deviceId) → Promise<void>',
      '  - 成功：resolve，audioElement.sinkId 更新为 deviceId',
      '  - 失败：reject，常见错误：',
      '    NotFoundError    deviceId 不存在',
      '    NotAllowedError  权限被拒（需用户激活 + HTTPS）',
      '    AbortError       操作被中止',
      '',
      '【audioSink 属性 —— 新一代替代方案（实验性）】',
      '  // 直接赋值字符串，无需 await，更简洁',
      '  audioElement.audioSink = audioOutputs[0].deviceId;',
      '  // 设回默认设备',
      '  audioElement.audioSink = "";',
      '  // 读取当前值',
      '  console.log(audioElement.audioSink);  // "" 或 deviceId',
      '  // 同样触发 sinkchange 事件',
      '',
      '【setSinkId vs audioSink】',
      '  setSinkId(deviceId)：Promise 异步，Chrome 110 前',
      '  audioSink 属性：同步赋值（内部仍异步生效），Chrome 110+',
      '  - audioSink 是新规范方向，逐步替代 setSinkId',
      '  - 两者都触发 sinkchange 事件',
      '  - 两者都要求 SecureContext（HTTPS/localhost）',
      '',
      '【权限模型】',
      '  1. 必须 SecureContext（HTTPS 或 localhost）',
      '  2. 首次 enumerateDevices 返回 label 为空，需先 getUserMedia 授权',
      '  3. 推荐流程：',
      '     - 先 navigator.permissions.query({name:"microphone"}) 查权限',
      '     - 或先 getUserMedia({audio:true}) 触发授权弹窗',
      '     - 授权后 enumerateDevices 才返回 label',
      '  4. setSinkId 本身无需额外权限，但 deviceId 来自 enumerateDevices',
      '  5. 部分浏览器要求用户激活（user gesture）才能切换',
      '',
      '【典型授权流程代码】',
      '  // 1. 请求麦克风权限以获取设备 label',
      '  try {',
      '    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });',
      '    stream.getTracks().forEach(t => t.stop()); // 仅用于授权，立即释放',
      '  } catch (e) { console.warn("麦克风授权失败:", e); }',
      '',
      '  // 2. 现在可拿到带 label 的设备列表',
      '  const devices = await navigator.mediaDevices.enumerateDevices();',
      '  const outputs = devices.filter(d => d.kind === "audiooutput");',
      '  outputs.forEach(d => console.log(d.label, d.deviceId));',
      '',
      '  // 3. 切换输出设备',
      '  await audio.setSinkId(outputs[1].deviceId); // 切到第二个设备',
      '',
      '【sinkchange 事件】',
      '  audio.addEventListener("sinkchange", () => {',
      '    console.log("输出设备已变更为:", audio.sinkId);',
      '  });',
      '  // 注意：sinkchange 不携带事件数据，需读 audio.sinkId',
      '',
      '【deviceId 的特殊性】',
      '  - 默认设备 deviceId 为 "default"',
      '  - 通信设备 deviceId 为 "communications"',
      '  - 其他设备为长串 opaque 字符串',
      '  - deviceId 在同源同会话内稳定，跨会话可能变化',
      '  - 想跨会话稳定需用 groupId（也不完全稳定）',
      '',
      '【浏览器支持】',
      `  setSinkId: ${f.setSinkId ? '✓' : '✗'}（Chrome/Edge 110+ 完整，旧 Chrome 需 flag）`,
      `  audioSink: ${f.audioSink ? '✓' : '✗'}（Chrome 110+ 实验性）`,
      `  enumerateDevices: ${f.enumerateDevices ? '✓' : '✗'}`,
      '  Safari: ✗ 不支持 setSinkId/audioSink',
      '  Firefox: ✗ 不支持',
      '',
      '【常见陷阱】',
      '  1. label 为空：未先 getUserMedia 授权，enumerateDevices 返回空 label',
      '  2. 只有 1 个 audiooutput：需插入耳机/蓝牙音箱才有多个可选',
      '  3. setSinkId 在 video 元素上也生效（视频声音也可路由）',
      '  4. 蓝牙设备切换后可能延迟数秒才生效',
      '  5. iOS Safari 完全不支持，移动端基本不可用',
    ].join('\n');
    this.setState({ sinkInfo: info });
    this._addLog('info', 'setSinkId 与 audioSink 演示完成');
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. setSinkId 与 audioSink —— 输出设备选择（Chrome 110+）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['setSinkId', f.setSinkId],
          ['audioSink', f.audioSink],
          ['enumerateDevices', f.enumerateDevices],
        ]),
        h(Tag, { color: 'primary' }, '输出设备'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'setSinkId(deviceId) → Promise<void> 切换媒体元素输出到指定音频设备，配合 navigator.mediaDevices.enumerateDevices() 过滤 kind===\'audiooutput\' 获取 deviceId。audioSink 属性（Chrome 110+ 实验性）是新规范方向，直接赋值字符串，逐步替代 setSinkId。两者均触发 sinkchange 事件。必须 SecureContext（HTTPS/localhost），enumerateDevices 返回 label 需先 getUserMedia 授权。Safari/Firefox 不支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('枚举设备 + setSinkId 演示', { type: 'primary', size: 'sm', onClick: () => this._runSinkDemo() }),
        ),
        h('audio', {
          class: 'sink-audio', controls: true, preload: 'metadata',
          style: { width: '100%', maxWidth: '480px', marginTop: '8px' },
        }),
        h('div', { class: 'hme-device-list hme-sink-list' },
          h('div', { class: 'hme-device-item' }, '（点击按钮枚举 audiooutput 设备，jsdom 不可用）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 1. 先 getUserMedia 授权以获取带 label 的设备列表
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
stream.getTracks().forEach(t => t.stop());

// 2. 枚举所有媒体设备
const devices = await navigator.mediaDevices.enumerateDevices();
const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
audioOutputs.forEach(d => console.log(d.label, d.deviceId));

// 3a. setSinkId 方式（异步 Promise）
await audioElement.setSinkId(audioOutputs[0].deviceId);
audioElement.addEventListener('sinkchange', () => {
  console.log('输出已切换到:', audioElement.sinkId);
});

// 3b. audioSink 方式（同步赋值，Chrome 110+ 实验性）
audioElement.audioSink = audioOutputs[0].deviceId;
// 设回默认
audioElement.audioSink = '';`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.sinkInfo || '（点击按钮查看 setSinkId 与 audioSink 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：preservesPitch 变速不变调 =====================

  _runPitchDemo() {
    const f = this._flags();
    this._injectStyle('hme-pitch-demo', `
      .hme-pitch-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const audio = this.$('.pitch-audio');
    this._registerMediaEl(audio);

    if (f.preservesPitch && audio) {
      try {
        // 默认 preservesPitch=true，变速不变调；设为 false 则变速变调（花栗鼠/低沉）
        const supportsStandard = 'preservesPitch' in audio;
        const supportsWebkit = 'webkitPreservesPitch' in audio;
        const supportsMoz = 'mozPreservesPitch' in audio;
        this._addLog('info', `preservesPitch 检测：standard=${supportsStandard}，webkit=${supportsWebkit}，moz=${supportsMoz}`);

        // 演示：playbackRate=2.0 + preservesPitch 切换
        audio.playbackRate = 2.0;
        if (supportsStandard) audio.preservesPitch = true;
        else if (supportsWebkit) audio.webkitPreservesPitch = true;
        else if (supportsMoz) audio.mozPreservesPitch = true;
        this._addLog('info', `playbackRate=${audio.playbackRate}，preservesPitch=true（变速不变调）`);

        // 切换为 false（变速变调）
        setTimeout(() => {
          try {
            if (supportsStandard) audio.preservesPitch = false;
            else if (supportsWebkit) audio.webkitPreservesPitch = false;
            else if (supportsMoz) audio.mozPreservesPitch = false;
            this._addLog('info', `preservesPitch=false（变速变调，花栗鼠效果）`);
          } catch { /* noop */ }
        }, 300);
      } catch (err) {
        this._addLog('warn', `preservesPitch 操作失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'preservesPitch 不可用，跳过真实变速演示（jsdom 无，主流浏览器支持）');
    }

    const info = [
      '===== preservesPitch 变速不变调 =====',
      '',
      '【playbackRate 与 preservesPitch】',
      '  audio.playbackRate = 2.0;          // 2 倍速',
      '  audio.preservesPitch = true;       // 变速不变调（默认）',
      '  // 效果：语速变快，但音高不变（适合语言学习/听书）',
      '',
      '  audio.playbackRate = 2.0;',
      '  audio.preservesPitch = false;      // 变速变调',
      '  // 效果：语速变快，音高也升高（花栗鼠效果，适合搞笑/DJ）',
      '',
      '【浏览器前缀兼容】',
      '  // 标准属性（Chrome/Firefox/Safari 现代版）',
      '  audio.preservesPitch = true;',
      '  // 旧 webkit 前缀（旧 Chrome/Safari）',
      '  audio.webkitPreservesPitch = true;',
      '  // 旧 moz 前缀（旧 Firefox）',
      '  audio.mozPreservesPitch = true;',
      '',
      '  // 兼容写法',
      '  function setPreservesPitch(el, v) {',
      '    if (\'preservesPitch\' in el) el.preservesPitch = v;',
      '    else if (\'webkitPreservesPitch\' in el) el.webkitPreservesPitch = v;',
      '    else if (\'mozPreservesPitch\' in el) el.mozPreservesPitch = v;',
      '  }',
      '',
      '【底层算法：SoundTouch】',
      '  - preservesPitch=true 时，浏览器用 SoundTouch 等时域/频域算法',
      '    在变速同时保持基频不变（WSOLA/相位声码器）',
      '  - preservesPitch=false 时，直接重采样（变速即变调）',
      '  - 算法有计算开销，移动端可能掉帧',
      '  - 极端速率（>4x 或 <0.5x）可能出现伪影',
      '',
      '【应用场景】',
      '  1. 语言学习：1.0 → 1.25 → 1.5 渐进变速，不变调易听清',
      '  2. 听书/播客：1.5x 变速不变调，省时',
      '  3. DJ 搓盘：变速变调制造效果',
      '  4. 视频转码预览：变速快速浏览',
      '  5. 无障碍：慢速播放（0.75x）不变调，听障友好',
      '  6. 音乐练习：0.5x 慢速不变调学乐器',
      '',
      '【相关属性】',
      '  audio.playbackRate;           // 当前速率 0.0625 - 16（默认 1）',
      '  audio.defaultPlaybackRate;    // 默认速率（load 后重置）',
      '  audio.preservesPitch;         // 变速是否保持音高（默认 true）',
      '  // ratechange 事件：playbackRate 变化时触发',
      '  audio.addEventListener("ratechange", () => {',
      '    console.log("速率变更:", audio.playbackRate);',
      '  });',
      '',
      '【变速 UI 实现】',
      '  // 速率选择按钮组',
      '  [0.5, 0.75, 1, 1.25, 1.5, 2].forEach(rate => {',
      '    btn.onclick = () => {',
      '      audio.playbackRate = rate;',
      '      audio.preservesPitch = true; // 不变调',
      '    };',
      '  });',
      '',
      '【浏览器支持】',
      `  preservesPitch: ${f.preservesPitch ? '✓' : '✗'}`,
      '  Chrome/Edge：✓ 标准属性',
      '  Safari：✓ 标准属性（旧版 webkit 前缀）',
      '  Firefox：✓ 标准属性（旧版 moz 前缀）',
      '',
      '【常见陷阱】',
      '  1. preservesPitch 默认 true，需显式设 false 才变调',
      '  2. 极端速率下音质下降（伪影/颤抖）',
      '  3. 移动端 preservesPitch=true 性能开销大，可能掉帧',
      '  4. 旧浏览器需 webkit/moz 前缀，务必做能力检测',
      '  5. 速率超出 0.0625-16 范围会被钳制',
      '  6. 某些浏览器 preservesPitch=false 时仍轻微保调（算法 bug）',
    ].join('\n');
    this.setState({ pitchInfo: info });
    this._addLog('info', 'preservesPitch 变速不变调演示完成');
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. preservesPitch —— 变速不变调（playbackRate + SoundTouch）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['preservesPitch', f.preservesPitch]]),
        h(Tag, { color: 'primary' }, '变速不变调'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'playbackRate 控制速率（0.0625-16，默认 1）。preservesPitch=true（默认）变速不变调（SoundTouch/WSOLA 算法保基频），适合语言学习/听书/无障碍慢速；preservesPitch=false 变速变调（花栗鼠/DJ 效果）。旧浏览器需 webkitPreservesPitch/mozPreservesPitch 前缀。ratechange 事件监听速率变化。极端速率下音质下降，移动端保调算法有性能开销。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行变速不变调演示', { type: 'primary', size: 'sm', onClick: () => this._runPitchDemo() }),
        ),
        h('audio', {
          class: 'pitch-audio', controls: true, preload: 'metadata',
          style: { width: '100%', maxWidth: '480px', marginTop: '8px' },
        }),
        h('div', { class: 'hme-pitch-bar' },
          h('span', {}, 'rate'),
          h('div', { class: 'hme-pitch-meter' },
            h('div', { class: 'hme-pitch-fill', style: { width: '50%' } }),
          ),
          h('span', {}, '1.0x'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 变速不变调（语言学习/听书）
audio.playbackRate = 1.5;
audio.preservesPitch = true;   // 默认 true，变速不变调

// 变速变调（花栗鼠/DJ 效果）
audio.playbackRate = 2.0;
audio.preservesPitch = false;  // 变速变调

// 兼容旧浏览器前缀
function setPreservesPitch(el, v) {
  if ('preservesPitch' in el) el.preservesPitch = v;
  else if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = v;
  else if ('mozPreservesPitch' in el) el.mozPreservesPitch = v;
}

// 监听速率变化
audio.addEventListener('ratechange', () => {
  console.log('当前速率:', audio.playbackRate);
});

// 速率选择按钮组
[0.5, 0.75, 1, 1.25, 1.5, 2].forEach(rate => {
  btn.onclick = () => {
    audio.playbackRate = rate;
    setPreservesPitch(audio, true);
  };
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.pitchInfo || '（点击按钮查看 preservesPitch 变速不变调完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：controlsList 精细控件 =====================

  _runControlsDemo() {
    const f = this._flags();
    this._injectStyle('hme-controls-demo', `
      .hme-controls-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const video = this.$('.cl-video');
    this._registerMediaEl(video);

    if (f.controlsList && video) {
      try {
        // controlsList 是 DOMTokenList，支持 add/remove/toggle/contains
        const cl = video.controlsList;
        this._addLog('info', `controlsList 类型：${cl && cl.constructor ? cl.constructor.name : 'DOMTokenList'}，当前 tokens：[${cl ? Array.from(cl).join(', ') : ''}]`);

        // 演示 toggle 各 token
        CONTROLS_LIST_TOKENS.forEach((token) => {
          try {
            if (cl && typeof cl.contains === 'function') {
              const has = cl.contains(token);
              this._addLog('info', `controlsList.contains("${token}") → ${has}`);
            }
          } catch (err) {
            this._addLog('warn', `controlsList.contains("${token}") 失败：${err && err.message}`);
          }
        });

        // 设置全部 token
        if (cl && typeof cl.add === 'function') {
          cl.add('nodownload', 'nofullscreen', 'noplaybackrate', 'noremoteplayback');
          this._addLog('info', `controlsList.add(...) 后 tokens：[${Array.from(cl).join(', ')}]`);
        }
      } catch (err) {
        this._addLog('warn', `controlsList 操作失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'controlsList 不可用，跳过真实操作（jsdom 无，Chrome 58+ 支持）');
    }

    // disablePictureInPicture 属性
    if (video && 'disablePictureInPicture' in video) {
      try {
        video.disablePictureInPicture = true;
        this._addLog('info', `disablePictureInPicture = true（隐藏 PiP 按钮，仅 video）`);
      } catch (err) {
        this._addLog('warn', `disablePictureInPicture 设置失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'disablePictureInPicture 不可用（Chrome/Safari 支持，Firefox 不支持）');
    }

    const info = [
      '===== controlsList 精细控件 =====',
      '',
      '【controlsList 是什么】',
      '  // HTMLMediaElement.controlsList 是 DOMTokenList',
      '  video.controlsList = "nodownload nofullscreen";',
      '  // 或用 DOMTokenList API',
      '  video.controlsList.add("nodownload");',
      '  video.controlsList.remove("nodownload");',
      '  video.controlsList.toggle("nodownload");',
      '  video.controlsList.contains("nodownload"); // true/false',
      '',
      '【四个标准 token】',
      '  nodownload          隐藏下载按钮（右键菜单 + 控件）',
      '  nofullscreen        隐藏全屏按钮',
      '  noplaybackrate      隐藏播放速率菜单（Chrome 58+）',
      '  noremoteplayback    隐藏远端播放（AirPlay/Chromecast）按钮',
      '',
      '【HTML 写法】',
      '  <video controls controlslist="nodownload nofullscreen noplaybackrate">',
      '    <source src="movie.mp4" type="video/mp4">',
      '  </video>',
      '',
      '【disablePictureInPicture 属性】',
      '  // 仅 HTMLVideoElement，隐藏 PiP 按钮',
      '  video.disablePictureInPicture = true;',
      '  // HTML 写法',
      '  <video controls disablepictureinpicture>',
      '  // 检测支持',
      '  const supports = \'disablePictureInPicture\' in video;',
      '',
      '【禁用右键菜单（防下载补充）】',
      '  // controlsList="nodownload" 仅隐藏按钮，右键菜单仍有"保存"',
      '  video.addEventListener("contextmenu", e => e.preventDefault());',
      '  // 注意：这只是前端 deterrent，无法真正防下载',
      '',
      '【token 与浏览器支持】',
      '  nodownload          Chrome ✓  Safari partial  Firefox ✗',
      '  nofullscreen        Chrome ✓  Safari ✓        Firefox ✗',
      '  noplaybackrate      Chrome ✓  Safari ✗        Firefox ✗',
      '  noremoteplayback    Chrome ✓  Safari AirPlay   Firefox ✗',
      '',
      '【应用场景】',
      '  1. 在线教育：nodownload 防止下载课件视频',
      '  2. 付费内容：nodownload + nofullscreen + contextmenu 拦截',
      '  3. 嵌入式播放：nofullscreen 强制小窗',
      '  4. 一致体验：noplaybackrate 禁止变速（考试场景）',
      '  5. 自定义远端：noremoteplayback 隐藏原生按钮，自建投屏',
      '',
      '【DOMTokenList 监听变化】',
      '  // controlsList 变化不触发专门事件，需 MutationObserver 监听属性',
      '  const obs = new MutationObserver(muts => {',
      '    for (const m of muts) {',
      '      if (m.attributeName === "controlslist") {',
      '        console.log("controlsList 变更:", video.controlsList.value);',
      '      }',
      '    }',
      '  });',
      '  obs.observe(video, { attributes: true });',
      '',
      '【浏览器支持】',
      `  controlsList: ${f.controlsList ? '✓' : '✗'}（Chrome 58+，Safari 部分，Firefox 不支持）`,
      '  disablePictureInPicture: Chrome/Safari ✓，Firefox ✗',
      '',
      '【常见陷阱】',
      '  1. controlsList 不影响实际能力，仅隐藏 UI（用户仍可键盘/JS 触发）',
      '  2. nodownload 不阻止右键"保存视频"，需配合 contextmenu 拦截',
      '  3. 无法真正防下载，只能 deterrent（DRM 需 EME，见 AdvancedMediaPage）',
      '  4. Firefox 完全不支持 controlsList，控件全显示',
      '  5. Safari 对 noplaybackrate 不支持，仍显示速率菜单',
      '  6. 移动端 Safari 控件 UI 与桌面不同，token 效果有差异',
    ].join('\n');
    this.setState({ controlsInfo: info });
    this._addLog('info', 'controlsList 精细控件演示完成');
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. controlsList —— 精细控件（nodownload/nofullscreen/noplaybackrate）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['controlsList', f.controlsList]]),
        h(Tag, { color: 'primary' }, '控件禁用'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'controlsList 是 DOMTokenList，四个标准 token：nodownload（隐藏下载）、nofullscreen（隐藏全屏）、noplaybackrate（隐藏速率）、noremoteplayback（隐藏投屏）。配合 disablePictureInPicture 属性隐藏 PiP 按钮（仅 video）。Chrome 58+ 支持，Safari 部分支持，Firefox 不支持。仅隐藏 UI 不影响实际能力，防下载需配合 contextmenu 拦截 + EME DRM。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 controlsList 演示', { type: 'primary', size: 'sm', onClick: () => this._runControlsDemo() }),
        ),
        h('video', {
          class: 'cl-video', controls: true, controlslist: 'nodownload nofullscreen noplaybackrate',
          disablepictureinpicture: true, preload: 'metadata', playsInline: true,
          style: { width: '100%', maxWidth: '480px', background: '#000', borderRadius: '6px', marginTop: '8px' },
        }),
        h('div', { class: 'hme-controls-host' },
          h('div', { class: 'fs-sm text-secondary mb-xs' }, 'controlsList tokens：'),
          h('div', {},
            ...CONTROLS_LIST_TOKENS.map((t) => h('span', { class: 'hme-cl-token hme-cl-token--on' }, t)),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `<!-- HTML 写法 -->
<video controls controlslist="nodownload nofullscreen noplaybackrate"
       disablepictureinpicture>
  <source src="movie.mp4" type="video/mp4">
</video>

// JS 操作 controlsList（DOMTokenList API）
video.controlsList.add('nodownload', 'nofullscreen');
video.controlsList.remove('nodownload');
video.controlsList.toggle('noplaybackrate');
video.controlsList.contains('nodownload'); // true

// disablePictureInPicture 隐藏 PiP 按钮（仅 video）
video.disablePictureInPicture = true;

// 防右键下载（补充 deterrent）
video.addEventListener('contextmenu', e => e.preventDefault());

// MutationObserver 监听 controlsList 变化
const obs = new MutationObserver(muts => {
  for (const m of muts) {
    if (m.attributeName === 'controlslist') {
      console.log('controlsList:', video.controlsList.value);
    }
  }
});
obs.observe(video, { attributes: true });`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.controlsInfo || '（点击按钮查看 controlsList 精细控件完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：disableRemotePlayback 与 RemotePlayback =====================

  async _runRemoteDemo() {
    const f = this._flags();
    this._injectStyle('hme-remote-demo', `
      .hme-remote-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const video = this.$('.remote-video');
    this._registerMediaEl(video);

    if (f.remotePlayback && video) {
      try {
        // video.remote 返回 RemotePlayback 对象
        const remote = video.remote || video.webkitRemotePlayback;
        if (remote) {
          this._addLog('info', `video.remote.state = ${remote.state}（disconnected/connecting/connected）`);
          this._addLog('info', `video.remote.type = ${remote.type}（none/airplay/dlna/chromecast）`);

          // 监听状态变化
          this.on(remote, 'connecting', () => this._addLog('info', 'RemotePlayback.connecting：正在连接远端设备'));
          this.on(remote, 'connect', () => this._addLog('info', 'RemotePlayback.connect：已连接远端设备'));
          this.on(remote, 'disconnect', () => this._addLog('info', 'RemotePlayback.disconnect：已断开远端设备'));

          // watchAvailability 监听可用远端设备
          if (typeof remote.watchAvailability === 'function') {
            try {
              const id = await remote.watchAvailability((available) => {
                this._addLog('info', `watchAvailability 回调：available=${available}`);
              });
              this._addAvailabilityId = id;
              this._addLog('info', `remote.watchAvailability() ✓ 注册成功 id=${id}`);
            } catch (err) {
              this._addLog('warn', `watchAvailability 失败：${err && err.message}（部分浏览器不支持）`);
            }
          }

          // prompt() 触发远端设备选择弹窗（需用户激活）
          // 真实调用：await remote.prompt();
          this._addLog('warn', 'remote.prompt() 需用户手势触发，演示不真实调用（点击"投屏"按钮可触发）');
        }
      } catch (err) {
        this._addLog('warn', `RemotePlayback 操作失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'RemotePlayback 不可用，跳过真实投屏（jsdom 无，Chrome/Edge 支持，Safari 用 webkit AirPlay）');
    }

    if (f.disableRemotePlayback && video) {
      try {
        video.disableRemotePlayback = false; // 允许投屏
        this._addLog('info', `disableRemotePlayback = false（允许投屏按钮显示）`);
      } catch (err) {
        this._addLog('warn', `disableRemotePlayback 设置失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'disableRemotePlayback 不可用');
    }

    const info = [
      '===== disableRemotePlayback 与 RemotePlayback =====',
      '',
      '【RemotePlayback API（仅 HTMLVideoElement）】',
      '  const remote = video.remote;  // RemotePlayback 对象',
      '  remote.state;   // "disconnected" | "connecting" | "connected"',
      '  remote.type;    // "none" | "airplay" | "dlna" | "chromecast"',
      '',
      '【核心方法】',
      '  // 触发远端设备选择弹窗（需用户激活）',
      '  remote.prompt()',
      '    .then(() => console.log("已选择远端设备"))',
      '    .catch(e => console.error("投屏失败:", e));',
      '',
      '  // 监听可用性变化',
      '  const id = await remote.watchAvailability(available => {',
      '    console.log("远端设备可用:", available);',
      '    // available=true 显示投屏按钮，false 隐藏',
      '  });',
      '  // 取消监听',
      '  remote.cancelWatchAvailability(id);',
      '',
      '【三个状态事件】',
      '  remote.addEventListener("connecting", () => {});  // 连接中',
      '  remote.addEventListener("connect",    () => {});  // 已连接',
      '  remote.addEventListener("disconnect", () => {});  // 已断开',
      '',
      '【disableRemotePlayback 属性】',
      '  // 禁用远端播放，隐藏投屏按钮',
      '  video.disableRemotePlayback = true;',
      '  // HTML 写法',
      '  <video controls disableremoteplayback>',
      '  // 与 controlsList="noremoteplayback" 等效但更彻底',
      '  // disableRemotePlayback 还会阻止 remote.prompt()',
      '',
      '【投屏完整流程代码】',
      '  const video = document.querySelector("video");',
      '  const remote = video.remote;',
      '',
      '  // 1. 监听可用性，显示/隐藏投屏按钮',
      '  remote.watchAvailability(available => {',
      '    castBtn.hidden = !available;',
      '  }).catch(() => { castBtn.hidden = false; }); // 不支持则总是显示',
      '',
      '  // 2. 监听状态',
      '  remote.addEventListener("connect", () => {',
      '    console.log("已投屏到:", remote.type);',
      '  });',
      '  remote.addEventListener("disconnect", () => {',
      '    console.log("已停止投屏");',
      '  });',
      '',
      '  // 3. 用户点击投屏按钮 → prompt',
      '  castBtn.onclick = () => remote.prompt();',
      '',
      '【AirPlay / Chromecast 集成】',
      '  - Safari：remote.type === "airplay"，需 Apple TV 或 AirPlay 接收器',
      '  - Chrome/Edge：remote.type === "chromecast"，需 Chromecast 设备',
      '  - 移动端：iOS Safari 自动显示 AirPlay 按钮（若 disableRemotePlayback=false）',
      '  - 桌面 Chrome：需手动调用 remote.prompt() 触发设备选择',
      '',
      '【RemotePlayback vs Presentation API】',
      '  RemotePlayback：',
      '    - 专为媒体元素（仅 video）设计',
      '    - 投屏的是媒体流（音频+视频）',
      '    - 浏览器原生处理编解码传输',
      '    - 接收端是 AirPlay/Chromecast 等媒体接收器',
      '  Presentation API：',
      '    - 通用页面投屏（任意 URL/内容）',
      '    - 投屏的是整个网页（DOM）',
      '    - 接收端是另一浏览器（Presentation Receiver）',
      '    - 用 navigator.presentation.startSession(url)',
      '    - 适合幻灯片/演示文稿投屏',
      '',
      '【浏览器支持】',
      `  RemotePlayback: ${f.remotePlayback ? '✓' : '✗'}`,
      '  Chrome/Edge：✓ Chromecast',
      '  Safari：✓ AirPlay（部分用 webkit- 前缀）',
      '  Firefox：✗ 不支持',
      `  disableRemotePlayback: ${f.disableRemotePlayback ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. RemotePlayback 仅 video 元素，audio 不支持',
      '  2. prompt() 必须用户激活（按钮点击），不能自动调用',
      '  3. watchAvailability 部分浏览器不支持，需 catch 降级',
      '  4. Safari AirPlay 按钮由系统渲染，disableRemotePlayback 才能隐藏',
      '  5. 投屏后 currentTime/playbackRate 仍由本地控制，双向同步',
      '  6. 离开页面自动 disconnect',
    ].join('\n');
    this.setState({ remoteInfo: info });
    this._addLog('info', 'RemotePlayback 与 disableRemotePlayback 演示完成');
  }

  async _remotePrompt() {
    const video = this.$('.remote-video');
    this._registerMediaEl(video);
    const remote = video && (video.remote || video.webkitRemotePlayback);
    if (!remote) {
      this._addLog('warn', 'video.remote 不可用，跳过 prompt（jsdom 无，Chrome/Edge/Safari 支持）');
      return;
    }
    try {
      await remote.prompt();
      this._addLog('info', `remote.prompt() ✓ 已触发投屏选择，state=${remote.state}`);
    } catch (err) {
      this._addLog('warn', `remote.prompt() 失败：${err && err.message}（可能无可用设备或非用户激活）`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. disableRemotePlayback 与 RemotePlayback —— AirPlay/Chromecast 投屏',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['RemotePlayback', f.remotePlayback],
          ['disableRemotePlayback', f.disableRemotePlayback],
        ]),
        h(Tag, { color: 'primary' }, '远端播放'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'video.remote 返回 RemotePlayback 对象（仅 video），state 为 disconnected/connecting/connected，type 为 airplay/dlna/chromecast。prompt() 触发设备选择弹窗（需用户激活），watchAvailability 监听可用性。disableRemotePlayback=true 彻底禁用投屏。Safari 走 AirPlay，Chrome 走 Chromecast。与 Presentation API 区别：RemotePlayback 投媒体流，Presentation API 投整个网页。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 RemotePlayback 演示', { type: 'primary', size: 'sm', onClick: () => this._runRemoteDemo() }),
          this._btn('投屏 prompt()', { size: 'sm', onClick: () => this._remotePrompt() }),
        ),
        h('video', {
          class: 'remote-video', controls: true, preload: 'metadata', playsInline: true,
          style: { width: '100%', maxWidth: '480px', background: '#000', borderRadius: '6px', marginTop: '8px' },
        }),
        h('div', { class: 'hme-remote-host' },
          h('span', { class: 'hme-remote-state hme-remote-state--disconnected' }, 'disconnected'),
          h('span', { class: 'fs-sm text-secondary', style: { marginLeft: '8px' } }, 'state：disconnected / connecting / connected'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const video = document.querySelector('video');
const remote = video.remote;  // RemotePlayback 对象

// 状态与类型
console.log(remote.state); // 'disconnected' | 'connecting' | 'connected'
console.log(remote.type);  // 'none' | 'airplay' | 'dlna' | 'chromecast'

// 监听可用性，显示/隐藏投屏按钮
remote.watchAvailability(available => {
  castBtn.hidden = !available;
}).catch(() => { castBtn.hidden = false; });

// 监听状态
remote.addEventListener('connect', () => {
  console.log('已投屏到:', remote.type);
});
remote.addEventListener('disconnect', () => {
  console.log('已停止投屏');
});

// 用户点击投屏按钮 → prompt（需用户激活）
castBtn.onclick = () => remote.prompt();

// disableRemotePlayback 彻底禁用
video.disableRemotePlayback = true;`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.remoteInfo || '（点击按钮查看 RemotePlayback 与 disableRemotePlayback 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：audioTracks/videoTracks 多轨道 =====================

  _runTracksDemo() {
    const f = this._flags();
    this._injectStyle('hme-tracks-demo', `
      .hme-tracks-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const audio = this.$('.tracks-audio');
    this._registerMediaEl(audio);

    if (f.audioTracks && audio) {
      try {
        const at = audio.audioTracks; // AudioTrackList
        if (at) {
          this._addLog('info', `audioTracks.length = ${at.length}（无多轨道源时为 0）`);
          // 监听 addtrack/removetrack/change
          this.on(at, 'addtrack', () => this._addLog('info', 'AudioTrackList.addtrack：新增音轨'));
          this.on(at, 'removetrack', () => this._addLog('info', 'AudioTrackList.removetrack：移除音轨'));
          this.on(at, 'change', () => this._addLog('info', 'AudioTrackList.change：启用轨道变更'));

          // 遍历音轨
          for (let i = 0; i < at.length; i++) {
            const track = at[i];
            this._addLog('info', `audioTrack[${i}]: id=${track.id} kind=${track.kind} label="${track.label}" lang=${track.language} enabled=${track.enabled}`);
          }

          // 切换启用轨道（多语言配音场景）
          if (at.length > 1) {
            at[1].enabled = true; // 启用第二条轨道
            this._addLog('info', '已启用 audioTrack[1]（切换配音）');
          }
        }
      } catch (err) {
        this._addLog('warn', `audioTracks 操作失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'audioTracks 不可用，跳过真实多轨道（jsdom 无，Safari 领先，Chrome 需多轨道容器）');
    }

    if (f.videoTracks && audio) {
      try {
        const vt = audio.videoTracks; // 视频元素用 video，audio 元素通常为空
        this._addLog('info', `videoTracks.length = ${vt ? vt.length : 0}（audio 元素通常无视频轨）`);
        if (vt && vt.length > 0) {
          for (let i = 0; i < vt.length; i++) {
            const track = vt[i];
            this._addLog('info', `videoTrack[${i}]: kind=${track.kind} label="${track.label}" selected=${track.selected}`);
          }
        }
      } catch (err) {
        this._addLog('warn', `videoTracks 操作失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'videoTracks 不可用（Safari 领先，Chrome 部分支持）');
    }

    const info = [
      '===== audioTracks/videoTracks 多轨道 =====',
      '',
      '【AudioTrackList / VideoTrackList】',
      '  const at = video.audioTracks;  // AudioTrackList（类数组）',
      '  const vt = video.videoTracks;  // VideoTrackList（类数组）',
      '  at.length;        // 音轨数',
      '  at[0];            // AudioTrack',
      '  at.getTrackById("main");  // 按 id 查找',
      '',
      '【AudioTrack 属性】',
      '  track.id;         // 唯一标识',
      '  track.kind;       // "main" | "alternative" | "commentary" | "translation"',
      '                    // | "descriptions"（无障碍） | "sign"（手语）',
      '  track.label;      // 人类可读名称，如 "英语配音"',
      '  track.language;   // BCP 47，如 "en" / "zh"',
      '  track.enabled;    // 是否启用（可多选，至少一条）',
      '',
      '【VideoTrack 属性】',
      '  track.id; track.kind; track.label; track.language;',
      '  track.selected;   // 是否选中（单选，同时只能一条）',
      '  // kind: "main" | "alternative" | "sign"（手语视角）',
      '',
      '【启用/切换轨道】',
      '  // 切换配音：禁用其他，启用目标',
      '  const at = video.audioTracks;',
      '  for (let i = 0; i < at.length; i++) at[i].enabled = false;',
      '  at[2].enabled = true;  // 启用第三条（如日语配音）',
      '',
      '  // 切换视角：单选',
      '  const vt = video.videoTracks;',
      '  vt[1].selected = true; // 切到第二视角',
      '',
      '【三个事件】',
      '  at.addEventListener("addtrack",    e => {}); // 新轨添加',
      '  at.addEventListener("removetrack", e => {}); // 轨道移除',
      '  at.addEventListener("change",      e => {}); // enabled/selected 变更',
      '',
      '【多语言播放器完整代码】',
      '  const video = document.querySelector("video");',
      '  const at = video.audioTracks;',
      '',
      '  // 渲染音轨选择 UI',
      '  function renderAudioTrackMenu() {',
      '    menu.innerHTML = "";',
      '    for (let i = 0; i < at.length; i++) {',
      '      const t = at[i];',
      '      const btn = document.createElement("button");',
      '      btn.textContent = `${t.label || t.language || "轨道" + i}`;',
      '      btn.disabled = t.enabled;',
      '      btn.onclick = () => {',
      '        // 单选：禁用其他，启用当前',
      '        for (let j = 0; j < at.length; j++) at[j].enabled = (j === i);',
      '      };',
      '      menu.appendChild(btn);',
      '    }',
      '  }',
      '  at.addEventListener("change", renderAudioTrackMenu);',
      '  at.addEventListener("addtrack", renderAudioTrackMenu);',
      '',
      '【与 textTracks 的区别（AdvancedMediaPage 已覆盖）】',
      '  audioTracks/videoTracks：音视频轨道（配音/视角）',
      '  textTracks：字幕/章节轨道（kind: subtitles/captions/chapters）',
      '  textTracks 用 mode: showing/hidden/disabled，不用 enabled',
      '',
      '【kind 取值规范】',
      '  音频：main（主音轨）/ alternative（备选）/ commentary（评论）',
      '       / translation（翻译）/ descriptions（无障碍描述）',
      '  视频：main / alternative / sign（手语视角）',
      '  字幕：subtitles / captions / chapters / metadata',
      '',
      '【浏览器支持】',
      `  audioTracks: ${f.audioTracks ? '✓' : '✗'}`,
      `  videoTracks: ${f.videoTracks ? '✓' : '✗'}`,
      '  Safari：✓ 领先支持（HLS 多轨道原生）',
      '  Chrome/Edge：partial（需多轨道容器 MP4/MPEG-DASH，HLS 需 hls.js）',
      '  Firefox：✗ 完全不支持',
      '',
      '【常见陷阱】',
      '  1. Chrome 普通单轨道 MP4 的 audioTracks.length === 0',
      '  2. 多轨道需容器支持（MP4 multiple audio tracks / HLS / DASH）',
      '  3. HLS 在 Safari 原生支持多轨道，Chrome 需 hls.js polyfill',
      '  4. audioTracks 在媒体未加载时为空，需 loadedmetadata 后访问',
      '  5. Firefox 完全不支持，需降级（服务端切换不同源）',
      '  6. enabled 多选可能导致混音，切换时记得禁用其他',
    ].join('\n');
    this.setState({ tracksInfo: info });
    this._addLog('info', 'audioTracks/videoTracks 多轨道演示完成');
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. audioTracks/videoTracks —— 多轨道（配音/视角切换）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['audioTracks', f.audioTracks],
          ['videoTracks', f.videoTracks],
        ]),
        h(Tag, { color: 'primary' }, '多轨道'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'audioTracks 返回 AudioTrackList，videoTracks 返回 VideoTrackList。AudioTrack.enabled 控制启用（可多选），VideoTrack.selected 控制选中（单选）。kind 取值 main/alternative/commentary/translation/descriptions/sign。事件 addtrack/removetrack/change。Safari 领先支持（HLS 多轨道原生），Chrome 需多轨道容器 MP4/DASH，Firefox 完全不支持。HLS 在 Chrome 需 hls.js polyfill。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行多轨道演示', { type: 'primary', size: 'sm', onClick: () => this._runTracksDemo() }),
        ),
        h('audio', {
          class: 'tracks-audio', controls: true, preload: 'metadata',
          style: { width: '100%', maxWidth: '480px', marginTop: '8px' },
        }),
        h('div', { class: 'hme-track-list' },
          h('div', { class: 'hme-track-item' },
            h('span', { class: 'hme-track-kind hme-track-kind--audio' }, 'audio'),
            h('span', { class: 'hme-device-label' }, '主音轨（main, zh）'),
            h('span', { class: 'hme-device-id' }, 'enabled=true'),
          ),
          h('div', { class: 'hme-track-item' },
            h('span', { class: 'hme-track-kind hme-track-kind--audio' }, 'audio'),
            h('span', { class: 'hme-device-label' }, '日语配音（alternative, ja）'),
            h('span', { class: 'hme-device-id' }, 'enabled=false'),
          ),
          h('div', { class: 'hme-track-item' },
            h('span', { class: 'hme-track-kind hme-track-kind--audio' }, 'audio'),
            h('span', { class: 'hme-device-label' }, '导演评论（commentary, en）'),
            h('span', { class: 'hme-device-id' }, 'enabled=false'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const video = document.querySelector('video');
const at = video.audioTracks;  // AudioTrackList

// 遍历音轨
for (let i = 0; i < at.length; i++) {
  const t = at[i];
  console.log(t.kind, t.label, t.language, t.enabled);
}

// 切换配音：禁用其他，启用目标（单选语义）
for (let i = 0; i < at.length; i++) at[i].enabled = false;
at[2].enabled = true;  // 启用日语配音

// 切换视角（VideoTrack.selected 单选）
const vt = video.videoTracks;
vt[1].selected = true;

// 监听变化
at.addEventListener('change', () => {
  console.log('音轨启用变更');
});
at.addEventListener('addtrack', e => console.log('新增音轨', e.track));`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.tracksInfo || '（点击按钮查看 audioTracks/videoTracks 多轨道完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：seekable/played/buffered 与媒体事件 =====================

  _runRangesDemo() {
    const f = this._flags();
    this._injectStyle('hme-ranges-demo', `
      .hme-ranges-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const audio = this.$('.ranges-audio');
    this._registerMediaEl(audio);

    const firedEvents = new Set();
    if (audio) {
      // 绑定核心媒体事件，统计触发情况
      MEDIA_EVENTS.forEach((evt) => {
        this.on(audio, evt, () => {
          if (!firedEvents.has(evt)) {
            firedEvents.add(evt);
            this._addLog('info', `媒体事件触发：${evt}（readyState=${audio.readyState}）`);
          }
        });
      });

      // 演示 TimeRanges 读取
      try {
        const readRanges = (name, ranges) => {
          if (!ranges) return `${name}: null`;
          const parts = [];
          for (let i = 0; i < ranges.length; i++) {
            parts.push(`[${ranges.start(i).toFixed(2)}-${ranges.end(i).toFixed(2)}]`);
          }
          return `${name}(len=${ranges.length}): ${parts.join(' ')}`;
        };
        this._addLog('info', readRanges('buffered', audio.buffered));
        this._addLog('info', readRanges('seekable', audio.seekable));
        this._addLog('info', readRanges('played', audio.played));
      } catch (err) {
        this._addLog('warn', `TimeRanges 读取失败：${err && err.message}`);
      }

      // 演示 seeking/seeked
      try {
        this.on(audio, 'seeking', () => this._addLog('info', `seeking：开始跳转到 ${audio.currentTime}s`));
        this.on(audio, 'seeked', () => this._addLog('info', `seeked：跳转完成，currentTime=${audio.currentTime}s`));
      } catch { /* noop */ }
    } else {
      this._addLog('warn', '未找到 ranges-audio 元素');
    }

    const info = [
      '===== seekable/played/buffered 与媒体事件 =====',
      '',
      '【TimeRanges 接口】',
      '  // 三个属性都返回 TimeRanges',
      '  audio.buffered;   // 已缓冲的时间区间',
      '  audio.seekable;   // 可跳转的时间区间',
      '  audio.played;     // 已播放的时间区间',
      '',
      '  // TimeRanges API',
      '  ranges.length;        // 区间段数（可能多段）',
      '  ranges.start(i);      // 第 i 段起始时间',
      '  ranges.end(i);        // 第 i 段结束时间',
      '',
      '  // 遍历所有区间',
      '  for (let i = 0; i < audio.buffered.length; i++) {',
      '    console.log(`缓冲段 ${i}: ${audio.buffered.start(i)} - ${audio.buffered.end(i)}`);',
      '  }',
      '',
      '【三大区间含义】',
      '  buffered: 浏览器已下载的数据（可能多段，如 MSE 分段下载）',
      '  seekable: 用户可跳转的范围（直播可能仅尾部，点播通常是全片）',
      '  played:   用户已播放过的范围（拖动进度条后可能多段）',
      '',
      '【核心媒体事件（按加载顺序）】',
      '  loadstart         开始加载',
      '  progress          加载中（多次触发）',
      '  suspend          加载暂停',
      '  abort            加载中止',
      '  error            加载错误',
      '  emptied          清空（src 改变）',
      '  stalled          加载停滞',
      '  loadedmetadata   元数据就绪（duration/dimensions）',
      '  loadeddata       当前帧数据就绪',
      '  canplay          可开始播放（不需停顿）',
      '  canplaythrough   可流畅播放到底',
      '  playing          从暂停/等待恢复播放',
      '  waiting          等待更多数据',
      '  seeking          开始跳转',
      '  seeked           跳转完成',
      '  ended            播放结束',
      '  durationchange   时长变化',
      '  timeupdate       当前时间变化（约 4Hz）',
      '  play             开始播放',
      '  pause            暂停',
      '  ratechange       速率变化',
      '  resize           视频尺寸变化',
      '  volumechange     音量/静音变化',
      '',
      '【seeking/seeked 跳转流程】',
      '  audio.currentTime = 30;  // 跳到 30 秒',
      '  // → 触发 seeking',
      '  // → 浏览器解码到目标位置',
      '  // → 触发 seeked',
      '  // → 若数据未缓冲可能触发 waiting → canplay',
      '',
      '【waiting/canplay 缓冲流程】',
      '  // 播放速度超过下载速度时：',
      '  // playing → waiting（缓冲不足）→ progress（下载）→ canplay → playing',
      '',
      '【缓冲策略代码】',
      '  // 1. 监听 buffered 更新进度条',
      '  audio.addEventListener("progress", () => {',
      '    const buffered = audio.buffered;',
      '    if (buffered.length > 0) {',
      '      const end = buffered.end(buffered.length - 1);',
      '      const pct = (end / audio.duration) * 100;',
      '      bufferBar.style.width = pct + "%";',
      '    }',
      '  });',
      '',
      '  // 2. 判断当前是否在缓冲区内',
      '  function isBuffered(time) {',
      '    for (let i = 0; i < audio.buffered.length; i++) {',
      '      if (time >= audio.buffered.start(i) && time <= audio.buffered.end(i)) {',
      '        return true;',
      '      }',
      '    }',
      '    return false;',
      '  }',
      '',
      '  // 3. waiting 时显示加载动画',
      '  audio.addEventListener("waiting", () => spinner.show());',
      '  audio.addEventListener("canplay", () => spinner.hide());',
      '',
      '【preload 三态】',
      '  preload="none"      不预加载（节省流量，移动端推荐）',
      '  preload="metadata"  仅加载元数据（时长/尺寸）',
      '  preload="auto"      预加载整个文件（默认）',
      '  // 注意：autoplay 优先于 preload',
      '',
      '【直播场景的 seekable】',
      '  // HLS/DASH 直播：seekable 通常是尾部滑窗',
      '  // 即 seekable.start = 直播最早可回看',
      '  //    seekable.end   = 当前直播点',
      '  const liveStart = audio.seekable.start(0);',
      '  const liveEnd = audio.seekable.end(0);',
      '  // 用户只能在 [liveStart, liveEnd] 内拖动（时移）',
      '',
      '【当前环境实际事件触发】',
      `  已触发事件：${firedEvents.size > 0 ? Array.from(firedEvents).join(', ') : '（jsdom 无真实媒体源，未触发）'}`,
      '',
      '【常见陷阱】',
      '  1. buffered 在 MSE 下可能多段，需遍历而非只取 end(0)',
      '  2. timeupdate 触发频率约 4Hz，做 UI 更新需节流',
      '  3. seeking 后 seeked 必然触发，但中间可能 waiting',
      '  4. 直播 duration 可能是 Infinity，progress 条需特殊处理',
      '  5. iOS 不允许 JS 触发 play（需用户手势），waiting 可能不触发',
      '  6. stalled 与 suspend 区别：stalled 是异常停滞，suspend 是正常暂停',
    ].join('\n');
    this.setState({ rangesInfo: info });
    this._addLog('info', `seekable/played/buffered 与媒体事件演示完成；已触发 ${firedEvents.size} 个事件`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. seekable/played/buffered 与媒体事件 —— TimeRanges 与缓冲策略',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'success' }, '✓ TimeRanges'),
        h(Tag, { color: 'primary' }, '媒体事件'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'buffered/seekable/played 均返回 TimeRanges（length/start(i)/end(i)），可能多段（MSE 分段下载）。22 个媒体事件按加载/播放/寻址/错误分类：loadstart→progress→loadedmetadata→canplay→playing，waiting/canplay 缓冲流程，seeking/seeked 跳转流程。timeupdate 约 4Hz。preload 三态 none/metadata/auto。直播 seekable 通常是尾部滑窗（时移）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行时间区间与事件演示', { type: 'primary', size: 'sm', onClick: () => this._runRangesDemo() }),
        ),
        h('audio', {
          class: 'ranges-audio', controls: true, preload: 'metadata',
          style: { width: '100%', maxWidth: '480px', marginTop: '8px' },
        }),
        h('div', { class: 'hme-ranges-host' },
          h('div', { class: 'fs-sm text-secondary mb-xs' }, 'buffered 区间可视化：'),
          h('div', { class: 'hme-ranges-bar' },
            h('div', { class: 'hme-ranges-seg hme-ranges-seg--buffered', style: { left: '0%', width: '35%' } }),
          ),
          h('div', { class: 'fs-sm text-secondary mb-xs', style: { marginTop: '6px' } }, 'played 区间：'),
          h('div', { class: 'hme-ranges-bar' },
            h('div', { class: 'hme-ranges-seg hme-ranges-seg--played', style: { left: '0%', width: '20%' } }),
          ),
          h('div', { class: 'fs-sm text-secondary mb-xs', style: { marginTop: '6px' } }, 'seekable 区间：'),
          h('div', { class: 'hme-ranges-bar' },
            h('div', { class: 'hme-ranges-seg hme-ranges-seg--seekable', style: { left: '0%', width: '100%' } }),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// TimeRanges 遍历
for (let i = 0; i < audio.buffered.length; i++) {
  console.log(\`缓冲段 \${i}: \${audio.buffered.start(i)} - \${audio.buffered.end(i)}\`);
}

// 更新缓冲进度条
audio.addEventListener('progress', () => {
  if (audio.buffered.length > 0) {
    const end = audio.buffered.end(audio.buffered.length - 1);
    bufferBar.style.width = (end / audio.duration * 100) + '%';
  }
});

// 跳转流程：seeking → (waiting) → seeked
audio.currentTime = 30;
audio.addEventListener('seeking', () => console.log('跳转开始'));
audio.addEventListener('seeked', () => console.log('跳转完成'));

// 缓冲流程：playing → waiting → canplay → playing
audio.addEventListener('waiting', () => spinner.show());
audio.addEventListener('canplay', () => spinner.hide());

// 判断某时间点是否已缓冲
function isBuffered(time) {
  for (let i = 0; i < audio.buffered.length; i++) {
    if (time >= audio.buffered.start(i) && time <= audio.buffered.end(i)) return true;
  }
  return false;
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.rangesInfo || '（点击按钮查看 TimeRanges 与媒体事件完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：实战与陷阱 =====================

  _runPatternDemo() {
    const f = this._flags();
    this._injectStyle('hme-pattern-demo', `
      .hme-pattern-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    // 综合演示：在多语言播放器上联动各特性
    const audio = this.$('.pattern-audio');
    this._registerMediaEl(audio);

    if (audio) {
      try {
        // 1. controlsList 隐藏下载
        if (f.controlsList && audio.controlsList) {
          audio.controlsList.add('nodownload', 'noplaybackrate');
          this._addLog('info', '实战：controlsList 添加 nodownload/noplaybackrate');
        } else {
          this._addLog('warn', '实战：controlsList 不可用，无法隐藏下载（Firefox 不支持）');
        }
        // 2. preservesPitch 变速不变调
        if (f.preservesPitch) {
          audio.playbackRate = 1.25;
          if ('preservesPitch' in audio) audio.preservesPitch = true;
          this._addLog('info', '实战：playbackRate=1.25 preservesPitch=true（变速不变调听书）');
        } else {
          this._addLog('warn', '实战：preservesPitch 不可用，跳过变速');
        }
        // 3. setSinkId 切设备（若可用）
        if (f.setSinkId && f.enumerateDevices) {
          this._addLog('info', '实战：setSinkId 可用，可让用户选输出设备（耳机/扬声器）');
        } else {
          this._addLog('warn', '实战：setSinkId 不可用，无法选输出设备（Safari/Firefox）');
        }
        // 4. audioTracks 切配音（若可用）
        if (f.audioTracks && audio.audioTracks && audio.audioTracks.length > 1) {
          audio.audioTracks[1].enabled = true;
          this._addLog('info', '实战：audioTracks 切换到第二条音轨（配音）');
        } else {
          this._addLog('warn', '实战：audioTracks 不可用或单轨道，无法切配音（Chrome 需多轨道容器，Firefox 不支持）');
        }
      } catch (err) {
        this._addLog('warn', `实战综合演示失败：${err && err.message}`);
      }
    }

    const info = [
      '===== 实战：多语言播放器与陷阱清单 =====',
      '',
      '【场景：多语言学习播放器】',
      '  需求：',
      '    - 多配音轨道切换（audioTracks）',
      '    - 输出设备选择（setSinkId，耳机/扬声器）',
      '    - 隐藏下载按钮（controlsList="nodownload"）',
      '    - 变速不变调听写（preservesPitch=true, playbackRate=1.25）',
      '    - 字幕同步（textTracks，见 AdvancedMediaPage）',
      '    - 缓冲进度显示（buffered TimeRanges）',
      '',
      '【完整实现代码】',
      '  const audio = document.querySelector("audio");',
      '',
      '  // 1. 隐藏下载与变速按钮',
      '  audio.controlsList.add("nodownload", "noplaybackrate");',
      '',
      '  // 2. 变速不变调（听写练习）',
      '  audio.playbackRate = 1.25;',
      '  audio.preservesPitch = true;',
      '  // 速率按钮组',
      '  [0.75, 1, 1.25, 1.5].forEach(r => {',
      '    rateBtn.onclick = () => { audio.playbackRate = r; };',
      '  });',
      '',
      '  // 3. 输出设备选择（Chrome 110+）',
      '  async function loadOutputDevices() {',
      '    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });',
      '    stream.getTracks().forEach(t => t.stop());',
      '    const devices = await navigator.mediaDevices.enumerateDevices();',
      '    const outputs = devices.filter(d => d.kind === "audiooutput");',
      '    outputs.forEach(d => {',
      '      const opt = new Option(d.label, d.deviceId);',
      '      deviceSelect.add(opt);',
      '    });',
      '  }',
      '  deviceSelect.onchange = async () => {',
      '    await audio.setSinkId(deviceSelect.value);',
      '  };',
      '',
      '  // 4. 配音轨道切换（Safari/多轨道容器）',
      '  const at = audio.audioTracks;',
      '  function renderTrackMenu() {',
      '    menu.innerHTML = "";',
      '    for (let i = 0; i < at.length; i++) {',
      '      const t = at[i];',
      '      const btn = new Option(t.label || t.language, i);',
      '      trackSelect.add(btn);',
      '    }',
      '  }',
      '  trackSelect.onchange = () => {',
      '    const idx = +trackSelect.value;',
      '    for (let i = 0; i < at.length; i++) at[i].enabled = (i === idx);',
      '  };',
      '  at.addEventListener("addtrack", renderTrackMenu);',
      '',
      '  // 5. 缓冲进度（见 Card 7）',
      '  audio.addEventListener("progress", updateBufferBar);',
      '',
      '【陷阱 1：tracks 浏览器差异】',
      '  - Safari HLS 原生多轨道，Chrome 需 hls.js polyfill',
      '  - Firefox 完全不支持 audioTracks/videoTracks',
      '  - 降级：服务端按语言返回不同源，前端切 src',
      '  // 降级方案',
      '  function switchLang(lang) {',
      '    if (audio.audioTracks && audio.audioTracks.length > 1) {',
      '      // 多轨道方案',
      '      const t = Array.from(audio.audioTracks).find(t => t.language === lang);',
      '      if (t) { audio.audioTracks.forEach(x => x.enabled = false); t.enabled = true; }',
      '    } else {',
      '      // 降级：切 src',
      '      const time = audio.currentTime;',
      '      audio.src = `audio_${lang}.mp3`;',
      '      audio.addEventListener("loadedmetadata", () => {',
      '        audio.currentTime = time; audio.play();',
      '      }, { once: true });',
      '    }',
      '  }',
      '',
      '【陷阱 2：iOS 限制】',
      '  - iOS Safari 不支持 setSinkId/audioSink（无法选输出设备）',
      '  - iOS 不允许 JS 触发 play()，必须用户手势',
      '  - iOS audioTracks 支持但需 HLS 多轨道',
      '  - iOS preservesPitch=true 性能差，长音频可能掉帧',
      '  - iOS 控件由系统渲染，controlsList 效果有限',
      '  - iOS 静音自动播放才允许，有声需用户手势',
      '',
      '【陷阱 3：无障碍字幕同步】',
      '  - audioTracks 切配音后，textTracks 字幕语言也要同步切',
      '  - 否则出现"日语配音 + 中文字幕"错配',
      '  for (let i = 0; i < audio.textTracks.length; i++) {',
      '    audio.textTracks[i].mode = (audio.textTracks[i].language === lang)',
      '      ? "showing" : "disabled";',
      '  }',
      '  - 字幕与配音切换有时差，需 cue 同步逻辑',
      '  - 无障碍描述音轨（kind="descriptions"）需单独 UI',
      '',
      '【陷阱 4：setSinkId 权限与可用性】',
      '  - 必须 HTTPS/localhost',
      '  - enumerateDevices 首次 label 为空，需先 getUserMedia',
      '  - Safari/Firefox 完全不支持，需降级提示用户用系统设置',
      '  - 蓝牙设备切换有数秒延迟，需 UI loading 提示',
      '',
      '【陷阱 5：controlsList 防下载的局限】',
      '  - 仅隐藏 UI，不阻止实际下载',
      '  - 右键"保存"仍可用，需 contextmenu 拦截',
      '  - 真正防下载需 EME DRM（见 AdvancedMediaPage）',
      '  - Firefox 完全不识别 controlsList',
      '',
      '【陷阱 6：preservesPitch 性能】',
      '  - 移动端保调算法开销大，长音频可能掉帧',
      '  - 极端速率（>4x）音质下降',
      '  - 旧浏览器前缀差异，务必做能力检测',
      '',
      '【陷阱 7：RemotePlayback 用户激活】',
      '  - prompt() 必须用户手势触发',
      '  - watchAvailability 部分浏览器不支持，需 catch',
      '  - 投屏后本地仍可控 currentTime，但需考虑同步',
      '',
      '【陷阱 8：媒体事件性能】',
      '  - timeupdate 约 4Hz，UI 更新需节流（requestAnimationFrame）',
      '  - progress 高频触发，避免重计算',
      '  - 多事件监听器需在卸载时移除（避免内存泄漏）',
      '',
      '【陷阱 9：TimeRanges 多段】',
      '  - MSE 下 buffered 可能多段，不能只取 end(0)',
      '  - 直播 duration 可能 Infinity，进度条需特殊处理',
      '  - seekable 在直播下是滑窗，不是全片',
      '',
      '【浏览器能力检测汇总（当前环境）】',
      `  setSinkId: ${f.setSinkId ? '✓' : '✗'}`,
      `  audioSink: ${f.audioSink ? '✓' : '✗'}`,
      `  preservesPitch: ${f.preservesPitch ? '✓' : '✗'}`,
      `  controlsList: ${f.controlsList ? '✓' : '✗'}`,
      `  disableRemotePlayback: ${f.disableRemotePlayback ? '✓' : '✗'}`,
      `  audioTracks: ${f.audioTracks ? '✓' : '✗'}`,
      `  videoTracks: ${f.videoTracks ? '✓' : '✗'}`,
      `  RemotePlayback: ${f.remotePlayback ? '✓' : '✗'}`,
      '',
      '【资源】',
      '  - MDN HTMLMediaElement: https://developer.mozilla.org/docs/Web/API/HTMLMediaElement',
      '  - Media Capture: https://developer.mozilla.org/docs/Web/API/Media_Devices_API',
      '  - Chrome setSinkId: https://developer.chrome.com/blog/audiooutputdeviceid',
      '  - RemotePlayback 规范: https://www.w3.org/TR/remote-playback/',
      '  - hls.js（多轨道 polyfill）: https://github.com/video-dev/hls.js',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('info', '实战与陷阱演示完成');
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战与陷阱 —— 多语言播放器（audioTracks + setSinkId + controlsList + preservesPitch）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.setSinkId || f.audioTracks || f.preservesPitch ? 'success' : 'error' },
          `高级特性 ${f.setSinkId || f.audioTracks || f.preservesPitch ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '多语言学习播放器综合实战：audioTracks 切配音（Safari/多轨道容器）+ setSinkId 选输出设备（Chrome 110+）+ controlsList 隐藏下载 + preservesPitch 变速不变调听写 + textTracks 字幕同步。9 大陷阱：tracks 浏览器差异（需 hls.js polyfill）、iOS 限制（不支持 setSinkId/JS 触发 play）、无障碍字幕同步错配、setSinkId 权限模型、controlsList 防下载局限、preservesPitch 性能、RemotePlayback 用户激活、媒体事件性能、TimeRanges 多段处理。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战综合演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('audio', {
          class: 'pattern-audio', controls: true, preload: 'metadata',
          style: { width: '100%', maxWidth: '480px', marginTop: '8px' },
        }),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 多语言学习播放器：综合 setSinkId + audioTracks + controlsList + preservesPitch
const audio = document.querySelector('audio');

// 1. 隐藏下载与变速按钮
audio.controlsList.add('nodownload', 'noplaybackrate');

// 2. 变速不变调（听写练习）
audio.playbackRate = 1.25;
audio.preservesPitch = true;

// 3. 输出设备选择（Chrome 110+）
async function loadOutputDevices() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach(t => t.stop()); // 仅授权，立即释放
  const devices = await navigator.mediaDevices.enumerateDevices();
  const outputs = devices.filter(d => d.kind === 'audiooutput');
  // 渲染到 <select>，onchange 时 setSinkId
}
deviceSelect.onchange = async () => {
  await audio.setSinkId(deviceSelect.value);
};

// 4. 配音轨道切换（多轨道容器/Safari HLS）
const at = audio.audioTracks;
trackSelect.onchange = () => {
  const idx = +trackSelect.value;
  for (let i = 0; i < at.length; i++) at[i].enabled = (i === idx);
  // 同步切换字幕语言
  for (let i = 0; i < audio.textTracks.length; i++) {
    audio.textTracks[i].mode =
      (audio.textTracks[i].language === at[idx].language) ? 'showing' : 'disabled';
  }
};

// 5. tracks 不可用时降级（Firefox）：切 src
function switchLangFallback(lang) {
  const time = audio.currentTime;
  audio.src = \`audio_\${lang}.mp3\`;
  audio.addEventListener('loadedmetadata', () => {
    audio.currentTime = time; audio.play();
  }, { once: true });
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看实战模式与 9 大陷阱完整清单）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 9：AudioSession API =====================

  _runAudioSessionDemo() {
    const f = this._flags();
    const lines = [];
    lines.push('===== AudioSession API 音频会话 =====');
    lines.push('');
    lines.push('【标准】W3C Audio Working Group 2024-2025 草案');
    lines.push('  - 规范每会话音频行为分类，影响多 tab 音频冲突策略');
    lines.push('  - 入口：navigator.audioSession');
    lines.push('');
    lines.push('【audioSession.type 取值（4 类会话）】');
    lines.push('  ambient        后台可与其他音频混合（默认，如游戏音效）');
    lines.push('  playback       主音频播放（音乐/视频），其他 playback 会被暂停');
    lines.push('  transient      短暂瞬时音（通知/铃声），临时压低其他音频');
    lines.push('  solo-ambient   独占环境音（语音导航），暂停其他音频');
    lines.push('');
    lines.push('【audioSession.stateChange 事件】');
    lines.push('  navigator.audioSession.addEventListener("statechange", e => {');
    lines.push('    console.log("session state:", navigator.audioSession.state);');
    lines.push('  });');
    lines.push('  // state 反映当前会话被系统调节后的状态（active/suspended 等）');
    lines.push('');
    lines.push('【与 HTMLMediaElement 协同】');
    lines.push('  const audio = document.querySelector("audio");');
    lines.push('  navigator.audioSession.type = "playback";  // 声明主播放会话');
    lines.push('  audio.play();  // 系统据此决定是否暂停其他 tab 的 playback');
    lines.push('');
    lines.push('【实战：多 tab 音频冲突处理】');
    lines.push('  // tab A 播放音乐：navigator.audioSession.type = "playback"');
    lines.push('  // tab B 打开并播放：系统检测到已有 playback，暂停 tab A');
    lines.push('  // tab A 监听 statechange → state 变 suspended → 同步暂停 UI');
    lines.push('  navigator.audioSession.addEventListener("statechange", () => {');
    lines.push('    if (navigator.audioSession.state === "suspended") {');
    lines.push('      audio.pause();          // 同步暂停按钮状态');
    lines.push('      showResumeButton();     // 提示用户可恢复');
    lines.push('    }');
    lines.push('  });');
    lines.push('');
    lines.push('【降级策略】');
    lines.push('  - 不支持 audioSession：浏览器按默认 ambient 行为混合，功能仍可用但无冲突管理');
    lines.push('  - 旧方案：监听 visibilitychange，页面隐藏时手动 audio.pause()');
    lines.push('  - 用 Page Visibility API 模拟会话切换');
    lines.push('');
    lines.push('【当前环境能力检测】');
    lines.push('  navigator.audioSession: ' + (f.audioSession ? '✓' : '✗'));
    lines.push('  audioSession.type 可读写: ' + (f.audioSessionType ? '✓' : '✗'));
    lines.push('');
    lines.push('【浏览器支持】');
    lines.push('  Safari 17.4+  ✓（最早实现）');
    lines.push('  Chrome        开发中（behind flag）');
    lines.push('  Firefox       未实现');
    lines.push('  jsdom/Node    ✗（无音频会话概念）');

    this.setState({ audioSessionInfo: lines.join('\n') });

    if (!f.audioSession) {
      this._addLog('warn', 'navigator.audioSession 不可用（Safari 17.4+，Chrome 开发中），仅展示文档与代码示例');
    } else {
      this._addLog('info', 'AudioSession API 可用，type=' + (navigator.audioSession && navigator.audioSession.type));
    }
  }

  _renderCard9() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '9. AudioSession API —— 音频会话与多 tab 冲突策略',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: f.audioSession ? 'success' : 'error' }, f.audioSession ? 'audioSession ✓' : 'audioSession ✗'),
        h(Tag, { color: 'primary' }, 'W3C Audio WG 2024-2025'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'AudioSession API（W3C Audio WG 2024-2025）通过 navigator.audioSession 声明当前页面的音频会话类型（ambient/playback/transient/solo-ambient），浏览器据此决定多 tab 音频冲突策略（如新 tab 播放 playback 时暂停旧 tab）。audioSession.type 读写会话类型，audioSession.stateChange 事件通知会话被系统调节。与 HTMLMediaElement 协同：声明 type=playback 后 play()，系统自动管理冲突。Safari 17.4+ 最早实现，Chrome 开发中，Firefox 未实现。降级：不支持时按默认 ambient 混合，可用 Page Visibility API 手动 pause 模拟。jsdom 无音频会话概念，演示仅展示文档与代码。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 AudioSession 文档与代码', { type: 'primary', size: 'sm', onClick: () => this._runAudioSessionDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'AudioSession 文档与示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '520px', overflow: 'auto' } },
          h('code', {}, s.audioSessionInfo || '（点击按钮查看 AudioSession API 完整文档与多 tab 冲突处理示例）')),
        h(Alert, {
          type: 'info',
          message: 'AudioSession API 解决多 tab 音频冲突',
          description: '通过声明会话类型让浏览器统一管理音频冲突，避免多 tab 同时播放杂音。Safari 17.4+ 已实现，Chrome 开发中。jsdom 无音频会话概念，演示仅展示文档与代码。真实浏览器可体验多 tab 冲突自动暂停。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

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
      h('h2', { class: 'section-title' }, 'HTMLMediaElement 高级特性深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'HTMLMediaElement 高级特性 —— setSinkId / audioSink / preservesPitch / controlsList / disableRemotePlayback / RemotePlayback / audioTracks / videoTracks / TimeRanges',
        description: '本页聚焦 HTMLMediaElement 自身高级特性（与 AdvancedMediaPage 的 MSE/EME/PiP 互补）：setSinkId(deviceId)/audioSink 属性切换输出设备（配合 navigator.mediaDevices.enumerateDevices() 过滤 audiooutput，Chrome 110+，sinkchange 事件）、preservesPitch 变速不变调（playbackRate + SoundTouch 算法，webkit/moz 前缀兼容）、controlsList 精细控件（nodownload/nofullscreen/noplaybackrate/noremoteplayback 四个 token + disablePictureInPicture，DOMTokenList API）、disableRemotePlayback 与 RemotePlayback（video.remote，state: disconnected/connecting/connected，prompt/watchAvailability，AirPlay/Chromecast，与 Presentation API 区别）、audioTracks/videoTracks 多轨道（AudioTrackList/VideoTrackList，enabled/selected，配音/视角切换，Safari 领先 Chrome 需多轨道容器 Firefox 不支持）、seekable/played/buffered 与 TimeRanges（length/start/end，22 个媒体事件，seeking/seeked/waiting/canplay 缓冲流程，直播滑窗）、实战多语言播放器与 9 大陷阱（tracks 浏览器差异/iOS 限制/无障碍字幕同步）。setSinkId/audioSink/audioTracks/RemotePlayback 在 jsdom 均不可用，所有调用前做 typeof/in 能力检测，不可用时仅 _addLog(\'warn\', ...)，绝不抛异常。真实浏览器 Chrome/Edge 110+ 可完整体验，Safari 对 audioTracks 支持领先。',
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
        this._renderCard9(),
      ),

      this._renderLogPanel(),
    ];
  }
}
