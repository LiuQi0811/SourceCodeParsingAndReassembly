// =====================================================================
// MediaSessionAPIPage.js —— Media Session API 媒体会话 完整 实验室
// 演示 W3C Media Session API（OS 级媒体控制集成）的全套能力：
//   1. 概述与动机：OS 级媒体控制集成需求（锁屏 / 通知栏 / 硬件键）/
//      Media Session API W3C Media WG / vs HTMLMediaElement API（仅页面内
//      控制）/ 浏览器支持 Chrome 73+ / Firefox 82+ / Safari 15+ 全主流稳定 /
//      与 <audio>/<video> 协同
//   2. navigator.mediaSession 入口：navigator.mediaSession /
//      mediaSession.metadata / mediaSession.playbackState /
//      mediaSession.setActionHandler / 安全上下文 / 与 HTMLMediaElement 自动同步
//   3. MediaMetadata 元数据：new MediaMetadata({ title, artist, album,
//      artwork: [{src, sizes, type}] }) / artwork 多尺寸封面 / 元数据显示在
//      锁屏 / 通知栏 / 与 MediaTrack 元数据区别
//   4. playbackState 状态：playbackState: 'none' | 'paused' | 'playing' /
//      反映当前播放状态 / OS 媒体键 UI 联动 / 与 HTMLMediaElement play/pause
//      事件同步
//   5. setActionHandler 动作处理：setActionHandler('play', () => {}) /
//      动作全集 play/pause/previoustrack/nexttrack/seekbackward/seekforward/
//      seekto/stop/seekto/skipad / handler 接收 details 参数 /
//      seek details.seekOffset / seekto details.seekTime
//   6. 实战：音乐播放器集成：HTMLAudioElement + MediaMetadata +
//      setActionHandler 全套 / 锁屏控制 / 通知栏封面 / 播放列表 prev/next /
//      进度 seek
//   7. 实战：视频播放器与投屏：video 元素 + Media Session / Chromecast 投屏
//      元数据 / 与 Picture-in-Picture 协同 / 后台播放控制
//   8. 陷阱与最佳实践：artwork 跨域 CORS / 通知栏占用清理（页面卸载 reset）/
//      setActionHandler null 清除 / 移动端电量 / 与 Service Worker Media 集成 /
//      iOS Safari 差异 / 无障碍协同
// 说明：所有特性调用前做能力检测（safe(()=>...) 包裹），不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 通常不实现
//       navigator.mediaSession / MediaMetadata / setActionHandler，统一兜底
//       返回 false；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看
//       锁屏 / 通知栏媒体控制效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { State } from '../../core/types.js';

interface MediaSessionAPIPageState extends State {
  logs: any;
  capsSummary: any;
  overviewInfo: any;
  entryInfo: any;
  metadataInfo: any;
  playbackStateInfo: any;
  actionHandlerInfo: any;
  musicPlayerInfo: any;
  videoCastInfo: any;
  pitfallsInfo: any;
}

export class MediaSessionAPIPage extends Page {
  declare state: MediaSessionAPIPageState;
  // —— 实例字段：在 render 前就需要可用的引用（render 早于 componentDidMount）——
  _inited: boolean = false;
  _dynamicStyles: any[] = [];
  _playbackStateMode: string = 'none';
  _activeAction: string = 'play';
  _playerState: string = 'paused';
  _playerTrackIndex: number = 0;

  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',         // Card 1：概述与动机
      entryInfo: '',            // Card 2：navigator.mediaSession 入口
      metadataInfo: '',         // Card 3：MediaMetadata 元数据
      playbackStateInfo: '',    // Card 4：playbackState 状态
      actionHandlerInfo: '',    // Card 5：setActionHandler 动作处理
      musicPlayerInfo: '',      // Card 6：实战：音乐播放器集成
      videoCastInfo: '',        // Card 7：实战：视频播放器与投屏
      pitfallsInfo: '',         // Card 8：陷阱与最佳实践
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];          // 动态创建并插入 head 的 <style> 元素列表
    this._playbackStateMode = 'none';  // Card 4 当前 playbackState 值
    this._activeAction = 'play';       // Card 5 当前展示的 action 名
    this._playerState = 'paused';      // Card 6 当前播放器状态
    this._playerTrackIndex = 0;        // Card 6 当前播放列表索引

    // 一次性能力检测：Media Session API 全家桶
    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      'mediaSession ' + c(f.mediaSession),
      'metadata ' + c(f.metadata),
      'playbackState ' + c(f.playbackState),
      'setActionHandler ' + c(f.setActionHandler),
      'MediaMetadata ctor ' + c(f.mediaMetadataCtor),
      'setPositionState ' + c(f.setPositionState),
      'cameraAction ' + c(f.cameraAction),
      'isSecureContext ' + c(f.isSecureContext),
    ];

    const summary = f.mediaSession
      ? 'Media Session API 能力检测：' + parts.join(' · ') + '。jsdom 通常不实现 navigator.mediaSession，但真实浏览器全主流稳定（Chrome 73+ / Firefox 82+ / Safari 15+）。setActionHandler 全动作（play/pause/previoustrack/nexttrack/seekbackward/seekforward/seekto/stop/skipad）支持完整；setPositionState 较新（Chrome 81+）。按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看锁屏 / 通知栏媒体控制效果。'
      : '当前环境不支持 navigator.mediaSession（jsdom 通常不实现）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（Chrome 73+ / Firefox 82+ / Safari 15+）中打开可完整演示锁屏 / 通知栏媒体控制。';

    this.setState({ capsSummary: summary });
    this._addLog(f.mediaSession ? 'info' : 'warn', '能力检测：' + parts.join('，'));
    if (!f.mediaSession) this._addLog('warn', 'navigator.mediaSession 不可用（jsdom 通常不实现，Chrome 73+ / Firefox 82+ / Safari 15+ 全主流稳定）');
    if (!f.mediaMetadataCtor) this._addLog('warn', 'window.MediaMetadata 构造函数不可用（jsdom 通常不实现，Chrome 57+ / Firefox 82+ / Safari 15+ 支持）');
    if (!f.setActionHandler) this._addLog('warn', 'navigator.mediaSession.setActionHandler 不可用（jsdom 通常不实现）');
    if (!f.setPositionState) this._addLog('warn', 'navigator.mediaSession.setPositionState 不可用（较新 API，Chrome 81+ / Safari 15+ 支持，Firefox 仍部分支持）');
    if (!f.isSecureContext) this._addLog('warn', '当前非安全上下文（Media Session API 要求 secure context：https 或 localhost）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 移除动态创建的 <style> 元素，便于 GC
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
    // 清理 mediaSession 设置（避免通知栏占用残留）
    if (this._flags().mediaSession) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        // 用 null 清除所有 action handler
        const actions = ['play', 'pause', 'previoustrack', 'nexttrack',
          'seekbackward', 'seekforward', 'seekto', 'stop', 'skipad'];
        for (const a of actions) {
          try { navigator.mediaSession.setActionHandler(a as any, null); } catch { /* noop */ }
        }
      } catch { /* noop */ }
    }
  }

  // —— 日志 / 按钮辅助 ——

  _addLog(type: any, content: any){
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any){
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(items: any) {
    return items.map(([label, ok]: any) =>
      h(Tag, { color: ok ? 'success' : 'error' }, label + ' ' + (ok ? '✓' : '✗')));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  // 用 safe 包裹：jsdom 不可用时返回 false，绝不抛异常
  _flags() {
    const safe = (fn: any) => { try { return fn(); } catch { return false; } };
    return {
      mediaSession: safe(() => 'mediaSession' in navigator &&
        typeof navigator.mediaSession === 'object' && navigator.mediaSession !== null),
      metadata: safe(() => typeof navigator.mediaSession === 'object' &&
        navigator.mediaSession !== null &&
        typeof navigator.mediaSession.metadata !== 'undefined'),
      playbackState: safe(() => typeof navigator.mediaSession === 'object' &&
        navigator.mediaSession !== null &&
        typeof navigator.mediaSession.playbackState !== 'undefined'),
      setActionHandler: safe(() => typeof navigator.mediaSession === 'object' &&
        navigator.mediaSession !== null &&
        typeof navigator.mediaSession.setActionHandler === 'function'),
      mediaMetadataCtor: safe(() => typeof window.MediaMetadata === 'function'),
      setPositionState: safe(() => typeof navigator.mediaSession === 'object' &&
        navigator.mediaSession !== null &&
        typeof navigator.mediaSession.setPositionState === 'function'),
      cameraAction: safe(() => typeof navigator.mediaSession === 'object' &&
        navigator.mediaSession !== null &&
        typeof (navigator.mediaSession as any).cameraAction !== 'undefined'),  // Chrome 扩展
      isSecureContext: safe(() => typeof window.isSecureContext === 'boolean'
        ? window.isSecureContext : false),
    };
  }

  // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
  _injectStyle(id: any, textContent: any){
    const existing = (document.getElementById(id) as any);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
    return style;
  }

  // —— 一次性注入全部基础演示样式 ——
  _injectBaseStyles() {
    this._injectStyle('media-session-demo', `
      /* ===== 通用 stage ===== */
      .ms-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 3：MediaMetadata 元数据预览 ===== */
      .ms-metadata-card {
        display: flex;
        gap: 12px;
        padding: 12px;
        margin-top: 8px;
        background: #1e293b;
        color: #e2e8f0;
        border-radius: 8px;
        align-items: center;
      }
      .ms-metadata-card .artwork {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #6366f1, #ec4899);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        flex-shrink: 0;
      }
      .ms-metadata-card .info {
        flex: 1;
        min-width: 0;
      }
      .ms-metadata-card .title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ms-metadata-card .artist {
        font-size: 13px;
        color: #93c5fd;
        margin-bottom: 2px;
      }
      .ms-metadata-card .album {
        font-size: 12px;
        color: #94a3b8;
      }
      /* ===== Card 4：playbackState 状态指示 ===== */
      .ms-state-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;
      }
      .ms-state-pill.none { background: #f1f5f9; color: #64748b; }
      .ms-state-pill.paused { background: #fef3c7; color: #92400e; }
      .ms-state-pill.playing { background: #dcfce7; color: #166534; }
      .ms-state-pill .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
      }
      .ms-state-pill.playing .dot { animation: ms-pulse 1.5s ease-in-out infinite; }
      @keyframes ms-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      /* ===== Card 5：action handler 矩阵 ===== */
      .ms-action-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 6px;
        margin-top: 8px;
      }
      .ms-action-cell {
        padding: 6px 10px;
        background: #fff;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        cursor: pointer;
        transition: all 0.15s;
      }
      .ms-action-cell:hover { background: #f1f5f9; }
      .ms-action-cell.active {
        background: #3b82f6;
        color: #fff;
        border-color: #2563eb;
      }
      /* ===== Card 6：音乐播放器 ===== */
      .ms-player {
        margin-top: 8px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 8px;
        padding: 16px;
      }
      .ms-player .track {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
      }
      .ms-player .track .cover {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }
      .ms-player .track .meta { flex: 1; min-width: 0; }
      .ms-player .track .title { font-size: 15px; font-weight: 600; }
      .ms-player .track .artist { font-size: 12px; color: #94a3b8; }
      .ms-player .controls {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: center;
      }
      .ms-player .ctrl-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #1e293b;
        border: 1px solid #334155;
        color: #e2e8f0;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ms-player .ctrl-btn.main {
        width: 48px;
        height: 48px;
        background: #3b82f6;
        border-color: #2563eb;
        font-size: 18px;
      }
      /* ===== Card 7：视频与投屏 ===== */
      .ms-video-stage {
        margin-top: 8px;
        background: #000;
        border-radius: 8px;
        padding: 12px;
        color: #e2e8f0;
      }
      .ms-video-stage .placeholder {
        height: 120px;
        background: linear-gradient(135deg, #1e293b, #0f172a);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        font-size: 13px;
        margin-bottom: 8px;
      }
      .ms-video-stage .pip-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      /* ===== 输出区 ===== */
      .ms-output {
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
      return '===== Media Session API 概述与动机 =====\n' +
        '\n' +
        '【规范归属】\n' +
        '  Media Session API 由 W3C Media Working Group 维护\n' +
        '  规范地址：https://w3c.github.io/mediasession/\n' +
        '  状态：W3C Working Draft（持续演进）\n' +
        '\n' +
        '【动机：OS 级媒体控制集成】\n' +
        '  传统 HTMLMediaElement API（<audio>/<video>）仅能控制页面内播放\n' +
        '  用户切到其他应用 / 锁屏 / 接耳机时无法继续控制播放\n' +
        '  Media Session API 让网页媒体"穿透"到 OS 层级：\n' +
        '    ✓ 锁屏界面显示媒体标题 / 艺术家 / 封面\n' +
        '    ✓ 通知栏显示媒体控件（play / pause / prev / next）\n' +
        '    ✓ 硬件媒体键（键盘 Fn + F7/F8/F9、耳机线控、蓝牙耳机）触发\n' +
        '    ✓ OS 媒体中心（Windows / macOS / Android / iOS 控制中心）集成\n' +
        '\n' +
        '【vs HTMLMediaElement API】\n' +
        '  HTMLMediaElement API：仅页面内播放控制（play/pause/loadeddata 等）\n' +
        '    无法显示锁屏 / 通知栏媒体控件\n' +
        '    硬件媒体键按下时浏览器可能默认跳到下一个媒体应用\n' +
        '  Media Session API：补充 OS 层级集成，与 HTMLMediaElement 协同：\n' +
        '    页面内仍用 <audio>/<video> 控制播放\n' +
        '    额外通过 navigator.mediaSession 暴露元数据 / 状态 / 动作处理\n' +
        '    浏览器自动同步 play/pause 事件到 OS 媒体 UI\n' +
        '\n' +
        '【核心三件套】\n' +
        '  1. navigator.mediaSession.metadata = new MediaMetadata({...})\n' +
        '     —— 设置元数据（标题 / 艺术家 / 专辑 / 封面）\n' +
        '  2. navigator.mediaSession.playbackState = "playing" | "paused" | "none"\n' +
        '     —— 反映当前播放状态（OS UI 联动）\n' +
        '  3. navigator.mediaSession.setActionHandler("play", () => {...})\n' +
        '     —— 注册动作处理（用户在锁屏 / 通知栏点 play/pause 等触发）\n' +
        '\n' +
        '【当前能力检测】\n' +
        '  navigator.mediaSession  = ' + f.mediaSession + '\n' +
        '  metadata                = ' + f.metadata + '\n' +
        '  playbackState           = ' + f.playbackState + '\n' +
        '  setActionHandler        = ' + f.setActionHandler + '\n' +
        '  MediaMetadata ctor      = ' + f.mediaMetadataCtor + '\n' +
        '  setPositionState        = ' + f.setPositionState + '\n' +
        '  cameraAction            = ' + f.cameraAction + ' (Chrome 扩展)\n' +
        '  isSecureContext         = ' + f.isSecureContext + '\n' +
        '\n' +
        '【浏览器支持】\n' +
        '  Chrome 73+ / Edge 79+ —— 全功能支持（含 setPositionState Chrome 81+）\n' +
        '  Firefox 82+ —— 支持核心 metadata + setActionHandler\n' +
        '  Safari 15+ —— iOS 15.1+ / macOS Safari 15+ 完整支持\n' +
        '  Android Chrome —— 与系统通知栏深度集成\n' +
        '  iOS Safari —— 与控制中心 / 锁屏集成（需用户激活播放后生效）\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  // 1. 创建 audio 元素\n' +
        '  const audio = new Audio("song.mp3");\n' +
        '\n' +
        '  // 2. 设置 MediaMetadata 元数据（显示在锁屏 / 通知栏）\n' +
        '  navigator.mediaSession.metadata = new MediaMetadata({\n' +
        '    title: "Song Title",\n' +
        '    artist: "Artist Name",\n' +
        '    album: "Album Name",\n' +
        '    artwork: [\n' +
        '      { src: "cover-96.png",  sizes: "96x96",   type: "image/png" },\n' +
        '      { src: "cover-256.png", sizes: "256x256", type: "image/png" },\n' +
        '      { src: "cover-512.png", sizes: "512x512", type: "image/png" },\n' +
        '    ],\n' +
        '  });\n' +
        '\n' +
        '  // 3. 反映播放状态（OS UI 联动）\n' +
        '  audio.addEventListener("play", () => {\n' +
        '    navigator.mediaSession.playbackState = "playing";\n' +
        '  });\n' +
        '  audio.addEventListener("pause", () => {\n' +
        '    navigator.mediaSession.playbackState = "paused";\n' +
        '  });\n' +
        '\n' +
        '  // 4. 注册动作处理（用户在锁屏点 play/pause 触发）\n' +
        '  navigator.mediaSession.setActionHandler("play",    () => audio.play());\n' +
        '  navigator.mediaSession.setActionHandler("pause",   () => audio.pause());\n' +
        '  navigator.mediaSession.setActionHandler("nexttrack",  () => loadNext());\n' +
        '  navigator.mediaSession.setActionHandler("previoustrack", () => loadPrev());';
    } catch (err: any) {
      return '读取 Media Session API 概述信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _runOverviewDemo() {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    const f = this._flags();
    this._addLog('overview', 'Media Session API 概述演示：mediaSession=' + f.mediaSession + ', MediaMetadata=' + f.mediaMetadataCtor);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— OS 级媒体控制集成需求',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['mediaSession', f.mediaSession],
          ['MediaMetadata', f.mediaMetadataCtor],
          ['secure', f.isSecureContext],
        ]),
        h(Tag, { color: 'primary' }, 'W3C Media WG'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Media Session API 由 W3C Media Working Group 维护，让网页媒体"穿透"到 OS 层级：锁屏界面显示标题 / 艺术家 / 封面，通知栏显示媒体控件，硬件媒体键（键盘 Fn 键 / 耳机线控 / 蓝牙耳机）触发，OS 媒体中心（Windows / macOS / Android / iOS 控制中心）集成。vs HTMLMediaElement API：后者仅控制页面内播放，无法显示锁屏 / 通知栏控件。核心三件套：metadata（元数据）/ playbackState（播放状态）/ setActionHandler（动作处理）。浏览器支持：Chrome 73+ / Firefox 82+ / Safari 15+ 全主流稳定，需安全上下文（https 或 localhost）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取概述信息', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 Media Session API 全景与完整代码示例）')),
        h(Alert, {
          type: 'info',
          message: 'Media Session API 让网页媒体穿透到 OS 层级：锁屏 / 通知栏 / 硬件键',
          description: '传统 HTMLMediaElement API 仅控制页面内播放；Media Session API 补充 OS 层级集成。核心三件套：metadata（标题 / 艺术家 / 专辑 / 封面）/ playbackState（playing/paused/none）/ setActionHandler（play/pause/prev/next/seek 等）。浏览器：Chrome 73+ / Firefox 82+ / Safari 15+，需安全上下文（https 或 localhost）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：navigator.mediaSession 入口 ===================

  _readEntryInfo() {
    const f = this._flags();
    try {
      let liveState = '(未读取)';
      if (f.mediaSession) {
        try {
          liveState = JSON.stringify({
            playbackState: navigator.mediaSession.playbackState,
            metadata: navigator.mediaSession.metadata
              ? {
                  title: navigator.mediaSession.metadata.title,
                  artist: navigator.mediaSession.metadata.artist,
                  album: navigator.mediaSession.metadata.album,
                  artworkLength: navigator.mediaSession.metadata.artwork
                    ? navigator.mediaSession.metadata.artwork.length : 0,
                }
              : null,
          }, null, 2);
        } catch (e: any) {
          liveState = '读取失败：' + e.name + ' - ' + e.message;
        }
      }
      return '===== navigator.mediaSession 入口 =====\n' +
        '\n' +
        '【入口对象】\n' +
        '  navigator.mediaSession 是 Media Session API 的根入口（只读属性）\n' +
        '  类型：MediaSession 对象（实例属性可读写）\n' +
        '  所有操作都通过 navigator.mediaSession.xxx 进行\n' +
        '\n' +
        '【可读写属性】\n' +
        '  navigator.mediaSession.metadata       —— MediaMetadata 实例或 null\n' +
        '  navigator.mediaSession.playbackState  —— "none" | "paused" | "playing"\n' +
        '\n' +
        '【可调用方法】\n' +
        '  navigator.mediaSession.setActionHandler(action, callback)\n' +
        '    —— 注册 / 清除动作处理（callback 传 null 清除）\n' +
        '  navigator.mediaSession.setPositionState(state)\n' +
        '    —— 设置播放进度（duration / position / playbackRate）\n' +
        '  navigator.mediaSession.setCameraActive(boolean)  —— Chrome 扩展\n' +
        '  navigator.mediaSession.setMicrophoneActive(boolean)  —— Chrome 扩展\n' +
        '\n' +
        '【安全上下文要求】\n' +
        '  Media Session API 要求 secure context（window.isSecureContext === true）\n' +
        '  即必须在 https:// 或 http://localhost 下访问\n' +
        '  普通 http:// 远程页面：navigator.mediaSession 可能存在但操作无效\n' +
        '  当前 isSecureContext = ' + f.isSecureContext + '\n' +
        '\n' +
        '【与 HTMLMediaElement 自动同步】\n' +
        '  浏览器自动同步 <audio>/<video> 的 play/pause 事件到 mediaSession：\n' +
        '    audio.play()  → 浏览器自动设置 playbackState = "playing"\n' +
        '    audio.pause() → 浏览器自动设置 playbackState = "paused"\n' +
        '  但建议显式监听 play/pause 事件手动设置 playbackState，确保跨浏览器一致\n' +
        '  metadata 不会自动同步，必须手动 new MediaMetadata(...) 设置\n' +
        '\n' +
        '【当前 navigator.mediaSession 实时状态】\n' +
        '  navigator.mediaSession 可用 = ' + f.mediaSession + '\n' +
        '  实时状态：\n' +
        liveState + '\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  // 检测能力\n' +
        '  if (!("mediaSession" in navigator)) {\n' +
        '    console.warn("Media Session API 不支持");\n' +
        '    return;\n' +
        '  }\n' +
        '\n' +
        '  // 必须在 secure context 下\n' +
        '  if (!window.isSecureContext) {\n' +
        '    console.warn("需要 https 或 localhost");\n' +
        '    return;\n' +
        '  }\n' +
        '\n' +
        '  // 读取当前状态\n' +
        '  console.log(navigator.mediaSession.playbackState);\n' +
        '  console.log(navigator.mediaSession.metadata);\n' +
        '\n' +
        '  // 设置 metadata（详见 Card 3）\n' +
        '  navigator.mediaSession.metadata = new MediaMetadata({\n' +
        '    title: "My Song",\n' +
        '    artist: "Me",\n' +
        '  });\n' +
        '\n' +
        '  // 设置 playbackState（详见 Card 4）\n' +
        '  navigator.mediaSession.playbackState = "playing";\n' +
        '\n' +
        '  // 注册 action handler（详见 Card 5）\n' +
        '  navigator.mediaSession.setActionHandler("play", () => {\n' +
        '    audio.play();\n' +
        '  });';
    } catch (err: any) {
      return '读取 navigator.mediaSession 入口信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _runEntryDemo() {
    this.setState({ entryInfo: this._readEntryInfo() });
    const f = this._flags();
    if (!f.mediaSession) {
      this._addLog('warn', 'navigator.mediaSession 不可用，仅展示说明（jsdom 通常不实现）');
    } else {
      this._addLog('info', '已读取 navigator.mediaSession 实时状态');
    }
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. navigator.mediaSession 入口 —— 安全上下文 / 与 HTMLMediaElement 同步',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['mediaSession', f.mediaSession],
          ['secure', f.isSecureContext],
        ]),
        h(Tag, { color: 'primary' }, 'Chrome 73+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.mediaSession 是 Media Session API 的根入口（只读属性，类型 MediaSession 对象）。可读写属性：metadata（MediaMetadata 实例）、playbackState（none/paused/playing）。可调用方法：setActionHandler(action, callback)、setPositionState(state)。要求安全上下文（window.isSecureContext === true，即 https 或 localhost）。与 HTMLMediaElement 自动同步：audio.play()/pause() 浏览器自动设置 playbackState，但 metadata 不会自动同步需手动设置。建议显式监听 play/pause 事件手动设置 playbackState 确保跨浏览器一致。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取入口信息', { type: 'primary', size: 'sm', disabled: !f.mediaSession, onClick: () => this._runEntryDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.entryInfo || '（点击「读取入口信息」查看 navigator.mediaSession 全貌）')),
        h(Alert, {
          type: 'warning',
          message: 'Media Session API 要求安全上下文（https 或 localhost）',
          description: '普通 http:// 远程页面 navigator.mediaSession 可能存在但操作无效。浏览器自动同步 <audio>/<video> 的 play/pause 到 playbackState，但 metadata 必须手动设置。建议显式监听 play/pause 事件确保跨浏览器一致。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：MediaMetadata 元数据 ===================

  _readMetadataInfo() {
    const f = this._flags();
    try {
      let liveMeta = '(未设置)';
      if (f.metadata && navigator.mediaSession.metadata) {
        const m = navigator.mediaSession.metadata;
        liveMeta = JSON.stringify({
          title: m.title,
          artist: m.artist,
          album: m.album,
          artwork: (m.artwork || []).map((a: any) => ({
            src: a.src, sizes: a.sizes, type: a.type,
          })),
        }, null, 2);
      }
      return '===== MediaMetadata 元数据 =====\n' +
        '\n' +
        '【构造函数】\n' +
        '  new MediaMetadata(metadataInit)\n' +
        '  metadataInit = { title, artist, album, artwork }\n' +
        '\n' +
        '【字段说明】\n' +
        '  title  —— 媒体标题（字符串，显示在锁屏 / 通知栏大字）\n' +
        '  artist —— 艺术家 / 演唱者（字符串）\n' +
        '  album  —— 专辑名（字符串，可选）\n' +
        '  artwork —— 封面图数组（MediaImage[]），每个 MediaImage 包含：\n' +
        '    src    —— 图片 URL（必须，支持相对 / 绝对 / data URL）\n' +
        '    sizes  —— 尺寸（如 "96x96" 或 "96x96 256x256"，类似 <link rel="icon">）\n' +
        '    type   —— MIME 类型（如 "image/png" / "image/webp"，可选但建议提供）\n' +
        '\n' +
        '【artwork 多尺寸封面】\n' +
        '  OS 不同 UI 需要不同尺寸：\n' +
        '    通知栏小图（约 96x96）\n' +
        '    锁屏大图（约 512x512 或更大）\n' +
        '    高 DPI 屏幕（2x / 3x）需更大尺寸\n' +
        '  浏览器根据 sizes 字段自动选择最合适尺寸\n' +
        '  建议至少提供 96 / 128 / 192 / 256 / 384 / 512 六档\n' +
        '\n' +
        '【元数据显示位置】\n' +
        '  Android：通知栏（小图 + 标题 / 艺术家）+ 锁屏（大图 + 控件）\n' +
        '  iOS Safari：控制中心 + 锁屏（大图 + 控件）\n' +
        '  macOS Safari：Now Playing 中心 + 控制中心\n' +
        '  Windows Chrome：音量控件旁的媒体条 + 通知中心\n' +
        '\n' +
        '【与 MediaTrack 元数据区别】\n' +
        '  HTMLMediaElement.audioTracks[i].label / MediaTrack.kind 等：\n' +
        '    描述"音轨 / 视频轨"的元数据（如"英语配音"、"中文字幕"）\n' +
        '    用于音轨切换，不显示在 OS UI\n' +
        '  MediaMetadata：描述"作品本身"的元数据（标题 / 艺术家 / 专辑 / 封面）\n' +
        '    用于 OS UI 显示，不参与音轨切换\n' +
        '  两者互补：MediaTrack 是技术层（轨道），MediaMetadata 是内容层（作品）\n' +
        '\n' +
        '【当前 mediaSession.metadata 实时状态】\n' +
        '  metadata 可用 = ' + f.metadata + '\n' +
        '  实时值：\n' +
        liveMeta + '\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  navigator.mediaSession.metadata = new MediaMetadata({\n' +
        '    title: "Never Gonna Give You Up",\n' +
        '    artist: "Rick Astley",\n' +
        '    album: "Whenever You Need Somebody",\n' +
        '    artwork: [\n' +
        '      { src: "https://example.com/cover-96.png",   sizes: "96x96",   type: "image/png" },\n' +
        '      { src: "https://example.com/cover-128.png",  sizes: "128x128", type: "image/png" },\n' +
        '      { src: "https://example.com/cover-192.png",  sizes: "192x192", type: "image/png" },\n' +
        '      { src: "https://example.com/cover-256.png",  sizes: "256x256", type: "image/png" },\n' +
        '      { src: "https://example.com/cover-384.png",  sizes: "384x384", type: "image/png" },\n' +
        '      { src: "https://example.com/cover-512.png",  sizes: "512x512", type: "image/png" },\n' +
        '    ],\n' +
        '  });\n' +
        '\n' +
        '【动态更新元数据】\n' +
        '  切换播放列表项时，重新赋值 metadata 即可：\n' +
        '    function loadTrack(track) {\n' +
        '      navigator.mediaSession.metadata = new MediaMetadata({\n' +
        '        title: track.title,\n' +
        '        artist: track.artist,\n' +
        '        album: track.album,\n' +
        '        artwork: track.artworks,\n' +
        '      });\n' +
        '    }\n' +
        '\n' +
        '【清除元数据】\n' +
        '  navigator.mediaSession.metadata = null;  // 清除（页面卸载时建议清除）';
    } catch (err: any) {
      return '读取 MediaMetadata 信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _runMetadataDemo() {
    const f = this._flags();
    if (!f.mediaMetadataCtor || !f.mediaSession) {
      this._addLog('warn', 'MediaMetadata 构造函数或 navigator.mediaSession 不可用（jsdom 通常不实现），仅展示说明');
      this.setState({ metadataInfo: this._readMetadataInfo() });
      return;
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        album: 'Whenever You Need Somebody',
        artwork: [
          { src: 'https://example.com/cover-96.png', sizes: '96x96', type: 'image/png' },
          { src: 'https://example.com/cover-256.png', sizes: '256x256', type: 'image/png' },
          { src: 'https://example.com/cover-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });
      this._addLog('info', '已设置 navigator.mediaSession.metadata（Rick Astley 示例）');
    } catch (err: any) {
      this._addLog('warn', '设置 metadata 失败：' + err.name + ' - ' + err.message);
    }
    this.setState({ metadataInfo: this._readMetadataInfo() });
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. MediaMetadata 元数据 —— title / artist / album / artwork',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['MediaMetadata ctor', f.mediaMetadataCtor],
          ['metadata', f.metadata],
        ]),
        h(Tag, { color: 'primary' }, '锁屏 / 通知栏显示'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'MediaMetadata 构造函数：new MediaMetadata({ title, artist, album, artwork })。artwork 是 MediaImage 数组，每项含 src（必填，URL）/ sizes（如 "96x96" 或 "96x96 256x256"）/ type（MIME 类型）。OS 不同 UI 需要不同尺寸：通知栏小图（96）、锁屏大图（512+）、高 DPI（2x/3x），建议至少提供 96/128/192/256/384/512 六档，浏览器根据 sizes 自动选择。元数据显示在 Android 通知栏 / 锁屏、iOS 控制中心 / 锁屏、macOS Now Playing、Windows 媒体条。与 MediaTrack 元数据区别：MediaTrack 描述音轨（"英语配音"）用于切换，MediaMetadata 描述作品本身（标题/艺术家）用于 OS UI 显示，两者互补。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行元数据演示', { type: 'primary', size: 'sm', onClick: () => this._runMetadataDemo() }),
        ),
        h('div', { class: 'ms-metadata-card' },
          h('div', { class: 'artwork' }, '♪'),
          h('div', { class: 'info' },
            h('div', { class: 'title' }, 'Never Gonna Give You Up'),
            h('div', { class: 'artist' }, 'Rick Astley'),
            h('div', { class: 'album' }, 'Whenever You Need Somebody · 模拟锁屏 / 通知栏显示'),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.metadataInfo || '（点击「运行元数据演示」设置 MediaMetadata 并查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'artwork 至少提供 96 / 128 / 192 / 256 / 384 / 512 六档尺寸',
          description: 'OS 不同 UI 需要不同尺寸（通知栏小图、锁屏大图、高 DPI），浏览器根据 sizes 字段自动选择。MediaMetadata 描述作品本身（标题/艺术家/专辑/封面），与 MediaTrack（描述音轨用于切换）互补。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：playbackState 状态 ===================

  _readPlaybackStateInfo() {
    const f = this._flags();
    try {
      let liveState = '(未读取)';
      if (f.playbackState) {
        try { liveState = navigator.mediaSession.playbackState; } catch (e: any) { liveState = '读取失败：' + e.message; }
      }
      return '===== playbackState 状态 =====\n' +
        '\n' +
        '【取值】\n' +
        '  navigator.mediaSession.playbackState = "none" | "paused" | "playing"\n' +
        '    none    —— 默认值（未播放或状态未知）\n' +
        '    paused  —— 暂停状态（OS UI 显示播放按钮 ▶）\n' +
        '    playing —— 播放中状态（OS UI 显示暂停按钮 ⏸）\n' +
        '\n' +
        '【反映当前播放状态】\n' +
        '  playbackState 反映网页媒体的当前播放状态，OS 媒体键 UI 据此联动：\n' +
        '    "playing" → OS UI 显示暂停按钮（用户可点暂停）\n' +
        '    "paused"  → OS UI 显示播放按钮（用户可点播放）\n' +
        '    "none"    → OS UI 不显示媒体控件（或显示但禁用）\n' +
        '\n' +
        '【与 HTMLMediaElement play/pause 事件同步】\n' +
        '  浏览器自动同步：<audio>/<video> 的 play 事件 → playbackState = "playing"\n' +
        '                  <audio>/<video> 的 pause 事件 → playbackState = "paused"\n' +
        '  但建议显式监听并设置（确保跨浏览器一致 + 处理 seeked 等边界）：\n' +
        '    audio.addEventListener("play",  () => navigator.mediaSession.playbackState = "playing");\n' +
        '    audio.addEventListener("pause", () => navigator.mediaSession.playbackState = "paused");\n' +
        '    audio.addEventListener("ended", () => navigator.mediaSession.playbackState = "none");\n' +
        '\n' +
        '【当前 playbackState】\n' +
        '  当前演示状态 = ' + this._playbackStateMode + '\n' +
        '  实时 playbackState = ' + liveState + '\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  // 显式监听并设置 playbackState\n' +
        '  const audio = document.querySelector("audio");\n' +
        '\n' +
        '  audio.addEventListener("play", () => {\n' +
        '    navigator.mediaSession.playbackState = "playing";\n' +
        '    updateUI();\n' +
        '  });\n' +
        '\n' +
        '  audio.addEventListener("pause", () => {\n' +
        '    navigator.mediaSession.playbackState = "paused";\n' +
        '    updateUI();\n' +
        '  });\n' +
        '\n' +
        '  audio.addEventListener("ended", () => {\n' +
        '    navigator.mediaSession.playbackState = "none";\n' +
        '    // 也可在此自动加载下一首\n' +
        '    loadNextTrack();\n' +
        '  });\n' +
        '\n' +
        '  // 用户从 OS 媒体键触发 play/pause 时，setActionHandler 回调中\n' +
        '  // 应同时调用 audio.play()/pause() 并设置 playbackState\n' +
        '  navigator.mediaSession.setActionHandler("play", () => {\n' +
        '    audio.play().then(() => {\n' +
        '      navigator.mediaSession.playbackState = "playing";\n' +
        '    });\n' +
        '  });';
    } catch (err: any) {
      return '读取 playbackState 信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _setPlaybackState(mode: any) {
    this._playbackStateMode = mode;
    const f = this._flags();
    if (f.playbackState) {
      try { navigator.mediaSession.playbackState = mode; } catch (err: any) {
        this._addLog('warn', '设置 playbackState 失败：' + err.name + ' - ' + err.message);
      }
    }
    this.setState({ playbackStateInfo: this._readPlaybackStateInfo() });
    const desc = ({
      none: '未播放（OS UI 不显示控件）',
      paused: '暂停（OS UI 显示 ▶）',
      playing: '播放中（OS UI 显示 ⏸）',
    } as Record<string, string>)[mode];
    this._addLog('state', '切换 playbackState → ' + mode + '（' + desc + '）');
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. playbackState 状态 —— none / paused / playing',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['playbackState', f.playbackState]]),
        h(Tag, { color: 'primary' }, 'OS UI 联动'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'playbackState 取值：none（默认，未播放）/ paused（暂停，OS UI 显示 ▶）/ playing（播放中，OS UI 显示 ⏸）。反映网页媒体当前状态，OS 媒体键 UI 据此联动。浏览器自动同步 <audio>/<video> 的 play/pause 事件到 playbackState，但建议显式监听并设置（确保跨浏览器一致 + 处理 ended 等边界）。setActionHandler 回调中应同时调用 audio.play()/pause() 并设置 playbackState。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', onClick: () => this.setState({ playbackStateInfo: this._readPlaybackStateInfo() }) }),
          this._btn('none', { size: 'sm', disabled: !f.playbackState, onClick: () => this._setPlaybackState('none') }),
          this._btn('paused', { size: 'sm', disabled: !f.playbackState, onClick: () => this._setPlaybackState('paused') }),
          this._btn('playing', { size: 'sm', disabled: !f.playbackState, onClick: () => this._setPlaybackState('playing') }),
        ),
        h('div', { class: 'ms-stage' },
          h('div', { class: 'fs-sm text-secondary' }, '当前 playbackState 模拟 OS UI：'),
          h('div', { class: 'ms-state-pill ' + this._playbackStateMode, style: { marginTop: '6px' } },
            h('span', { class: 'dot' }),
            this._playbackStateMode === 'playing' ? '播放中 ⏸ (OS 显示暂停键)' :
              this._playbackStateMode === 'paused' ? '已暂停 ▶ (OS 显示播放键)' :
              '未播放 (OS 不显示控件)',
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.playbackStateInfo || '（点击按钮切换 playbackState 并查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'playbackState 反映当前播放状态，OS 媒体键 UI 据此联动',
          description: 'playing → OS UI 显示暂停按钮，paused → OS UI 显示播放按钮，none → OS UI 不显示控件。浏览器自动同步 play/pause 事件，但建议显式监听设置。ended 事件应设为 none 或自动加载下一首。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：setActionHandler 动作处理 ===================

  _readActionHandlerInfo() {
    const f = this._flags();
    try {
      const actions = [
        ['play', '播放（用户点 OS UI ▶ 或硬件播放键）'],
        ['pause', '暂停（用户点 OS UI ⏸ 或硬件暂停键）'],
        ['previoustrack', '上一曲（用户点 OS UI ⏮）'],
        ['nexttrack', '下一曲（用户点 OS UI ⏭）'],
        ['seekbackward', '后退（用户点 OS UI « 或硬件后退键），details.seekOffset 默认 10s'],
        ['seekforward', '前进（用户点 OS UI » 或硬件前进键），details.seekOffset 默认 10s'],
        ['seekto', '跳转到指定时间，details.seekTime / details.fastSeek'],
        ['stop', '停止（用户点 OS UI ⏹ 或硬件停止键）'],
        ['skipad', '跳过广告（视频广告场景）'],
      ];
      let actionLines = '';
      for (const [name, desc] of actions) {
        actionLines += '  ' + name.padEnd(16) + ' —— ' + desc + '\n';
      }
      return '===== setActionHandler 动作处理 =====\n' +
        '\n' +
        '【API 签名】\n' +
        '  navigator.mediaSession.setActionHandler(action, callback)\n' +
        '    action   —— 字符串，动作名（如 "play"）\n' +
        '    callback —— 处理函数，接收 details 参数；传 null 清除该动作处理\n' +
        '\n' +
        '【动作全集】\n' +
        actionLines +
        '\n' +
        '【details 参数详解】\n' +
        '  seekbackward / seekforward 的 details：\n' +
        '    { seekOffset: number }  —— 后退 / 前移秒数（用户在 OS UI 选择"快进 30s"等）\n' +
        '    若 seekOffset 缺失，应用默认值（如 10s）\n' +
        '  seekto 的 details：\n' +
        '    { seekTime: number, fastSeek: boolean }\n' +
        '    seekTime  —— 目标时间（秒，绝对位置）\n' +
        '    fastSeek  —— 是否快速 seek（视频快进拖动时为 true，精度低但快）\n' +
        '\n' +
        '【当前演示动作】\n' +
        '  当前选中 = ' + this._activeAction + '\n' +
        '  setActionHandler 可用 = ' + f.setActionHandler + '\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  const audio = document.querySelector("audio");\n' +
        '\n' +
        '  // 基础播放控制\n' +
        '  navigator.mediaSession.setActionHandler("play",  () => audio.play());\n' +
        '  navigator.mediaSession.setActionHandler("pause", () => audio.pause());\n' +
        '  navigator.mediaSession.setActionHandler("stop",  () => { audio.pause(); audio.currentTime = 0; });\n' +
        '\n' +
        '  // 上一曲 / 下一曲\n' +
        '  navigator.mediaSession.setActionHandler("previoustrack", () => loadTrack(currentIndex - 1));\n' +
        '  navigator.mediaSession.setActionHandler("nexttrack",     () => loadTrack(currentIndex + 1));\n' +
        '\n' +
        '  // 后退 / 前进（接收 details.seekOffset）\n' +
        '  navigator.mediaSession.setActionHandler("seekbackward", (details: any) => {\n' +
        '    const offset = details.seekOffset || 10;\n' +
        '    audio.currentTime = Math.max(0, audio.currentTime - offset);\n' +
        '  });\n' +
        '  navigator.mediaSession.setActionHandler("seekforward", (details: any) => {\n' +
        '    const offset = details.seekOffset || 10;\n' +
        '    audio.currentTime = Math.min(audio.duration, audio.currentTime + offset);\n' +
        '  });\n' +
        '\n' +
        '  // 跳转到指定时间（接收 details.seekTime）\n' +
        '  navigator.mediaSession.setActionHandler("seekto", (details: any) => {\n' +
        '    if (details.fastSeek) {\n' +
        '      // 快速 seek（精度低，视频快进拖动）\n' +
        '      audio.fastSeek && audio.fastSeek(details.seekTime);\n' +
        '    } else {\n' +
        '      audio.currentTime = details.seekTime;\n' +
        '    }\n' +
        '  });\n' +
        '\n' +
        '  // 跳过广告\n' +
        '  navigator.mediaSession.setActionHandler("skipad", () => skipCurrentAd());\n' +
        '\n' +
        '【清除 action handler】\n' +
        '  navigator.mediaSession.setActionHandler("play", null);  // 清除 play 处理\n' +
        '  // 页面卸载时建议清除所有：\n' +
        '  ["play", "pause", "previoustrack", "nexttrack", "seekbackward",\n' +
        '   "seekforward", "seekto", "stop", "skipad"].forEach((a: any) => {\n' +
        '    navigator.mediaSession.setActionHandler(a as any, null);\n' +
        '  });';
    } catch (err: any) {
      return '读取 setActionHandler 信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _setActiveAction(action: any) {
    this._activeAction = action;
    const f = this._flags();
    if (!f.setActionHandler) {
      this._addLog('warn', 'setActionHandler 不可用（jsdom 通常不实现），仅展示说明');
    } else {
      // 注册一个真实的 action handler 演示
      try {
        navigator.mediaSession.setActionHandler(action, (details: any) => {
          this._addLog('info', 'action ' + action + ' 触发：details=' + JSON.stringify(details || {}));
        });
        this._addLog('info', '已注册 ' + action + ' action handler（真实浏览器可在 OS UI 触发）');
      } catch (err: any) {
        this._addLog('warn', '注册 ' + action + ' handler 失败：' + err.name + ' - ' + err.message);
      }
    }
    this.setState({ actionHandlerInfo: this._readActionHandlerInfo() });
  }

  _runActionHandlerDemo() {
    const f = this._flags();
    if (!f.setActionHandler) {
      this._addLog('warn', 'setActionHandler 不可用（jsdom 通常不实现），仅展示说明');
    }
    this.setState({ actionHandlerInfo: this._readActionHandlerInfo() });
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const actions = ['play', 'pause', 'previoustrack', 'nexttrack',
      'seekbackward', 'seekforward', 'seekto', 'stop', 'skipad'];
    const card = new Card({
      title: '5. setActionHandler 动作处理 —— play / pause / seek / skipad 全集',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['setActionHandler', f.setActionHandler]]),
        h(Tag, { color: 'primary' }, '9 大动作'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'setActionHandler(action, callback) 注册 OS 媒体键动作处理。action 全集：play/pause/previoustrack/nexttrack/seekbackward/seekforward/seekto/stop/skipad。callback 接收 details 参数：seekbackward/seekforward 的 details.seekOffset（默认 10s），seekto 的 details.seekTime（绝对时间）+ details.fastSeek（快速 seek）。callback 传 null 清除该动作处理。页面卸载时建议清除所有 handler 避免通知栏占用残留。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', onClick: () => this._runActionHandlerDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '点击下方动作格注册对应 handler（真实浏览器可在 OS UI 触发）：'),
        h('div', { class: 'ms-action-grid' },
          ...actions.map((a: any) =>
            h('div', {
              class: 'ms-action-cell ' + (this._activeAction === a ? 'active' : ''),
              onClick: () => this._setActiveAction(a),
            }, a)),
        ),
        h('div', { class: 'ms-output' },
          '当前选中：' + this._activeAction + '\n' +
          'setActionHandler 可用：' + (f.setActionHandler ? '是' : '否（jsdom 不实现）') + '\n' +
          '真实浏览器：点击 OS 媒体键 / 锁屏控件 / 通知栏按钮 → 触发对应 handler'),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.actionHandlerInfo || '（点击动作格或「读取信息」查看 setActionHandler 全集与代码示例）')),
        h(Alert, {
          type: 'warning',
          message: '页面卸载时必须清除 action handler（传 null），避免通知栏占用残留',
          description: 'setActionHandler(action, null) 清除单个；遍历所有动作清除全部。seekbackward/seekforward 用 details.seekOffset（默认 10s），seekto 用 details.seekTime（绝对时间）+ details.fastSeek（快速 seek）。9 大动作覆盖主流媒体键场景。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：实战：音乐播放器集成 ===================

  _readMusicPlayerInfo() {
    const f = this._flags();
    try {
      return '===== 实战：音乐播放器集成 =====\n' +
        '\n' +
        '【场景】\n' +
        '  HTMLAudioElement + MediaMetadata + setActionHandler 全套集成\n' +
        '  播放列表 / 锁屏控制 / 通知栏封面 / 上一曲下一曲 / 进度 seek\n' +
        '\n' +
        '【播放列表数据结构】\n' +
        '  const playlist = [\n' +
        '    { title: "Song A", artist: "Artist X", album: "Album 1",\n' +
        '      src: "song-a.mp3", artwork: [...] },\n' +
        '    { title: "Song B", artist: "Artist Y", album: "Album 2",\n' +
        '      src: "song-b.mp3", artwork: [...] },\n' +
        '  ];\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  const audio = new Audio();\n' +
        '  let currentIndex = 0;\n' +
        '\n' +
        '  function loadTrack(index) {\n' +
        '    currentIndex = (index + playlist.length) % playlist.length;\n' +
        '    const track = playlist[currentIndex];\n' +
        '\n' +
        '    // 1. 设置 audio 源并播放\n' +
        '    audio.src = track.src;\n' +
        '    audio.play().catch((err: any) => console.warn("播放失败：", err));\n' +
        '\n' +
        '    // 2. 设置 MediaMetadata（锁屏 / 通知栏显示）\n' +
        '    if ("mediaSession" in navigator) {\n' +
        '      navigator.mediaSession.metadata = new MediaMetadata({\n' +
        '        title: track.title,\n' +
        '        artist: track.artist,\n' +
        '        album: track.album,\n' +
        '        artwork: track.artwork,\n' +
        '      });\n' +
        '    }\n' +
        '  }\n' +
        '\n' +
        '  // 3. 监听 play/pause 同步 playbackState\n' +
        '  audio.addEventListener("play",  () => {\n' +
        '    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";\n' +
        '  });\n' +
        '  audio.addEventListener("pause", () => {\n' +
        '    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";\n' +
        '  });\n' +
        '  audio.addEventListener("ended", () => loadTrack(currentIndex + 1));  // 自动下一曲\n' +
        '\n' +
        '  // 4. 注册 action handler（OS 媒体键触发）\n' +
        '  if ("mediaSession" in navigator) {\n' +
        '    navigator.mediaSession.setActionHandler("play",      () => audio.play());\n' +
        '    navigator.mediaSession.setActionHandler("pause",     () => audio.pause());\n' +
        '    navigator.mediaSession.setActionHandler("previoustrack", () => loadTrack(currentIndex - 1));\n' +
        '    navigator.mediaSession.setActionHandler("nexttrack",     () => loadTrack(currentIndex + 1));\n' +
        '    navigator.mediaSession.setActionHandler("seekbackward", (details: any) => {\n' +
        '      audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10));\n' +
        '    });\n' +
        '    navigator.mediaSession.setActionHandler("seekforward",  (details: any) => {\n' +
        '      audio.currentTime = Math.min(audio.duration,\n' +
        '        audio.currentTime + (details.seekOffset || 10));\n' +
        '    });\n' +
        '    navigator.mediaSession.setActionHandler("seekto", (details: any) => {\n' +
        '      if (details.seekTime != null) audio.currentTime = details.seekTime;\n' +
        '    });\n' +
        '  }\n' +
        '\n' +
        '  // 5. 设置 setPositionState（让 OS UI 显示进度条）\n' +
        '  if (navigator.mediaSession && navigator.mediaSession.setPositionState) {\n' +
        '    audio.addEventListener("timeupdate", () => {\n' +
        '      if (!isFinite(audio.duration)) return;\n' +
        '      navigator.mediaSession.setPositionState({\n' +
        '        duration: audio.duration,\n' +
        '        position: audio.currentTime,\n' +
        '        playbackRate: audio.playbackRate,\n' +
        '      });\n' +
        '    });\n' +
        '  }\n' +
        '\n' +
        '  // 初始加载第一首\n' +
        '  loadTrack(0);\n' +
        '\n' +
        '【当前演示状态】\n' +
        '  当前播放列表索引 = ' + this._playerTrackIndex + '\n' +
        '  当前播放器状态 = ' + this._playerState + '\n' +
        '  MediaMetadata ctor = ' + f.mediaMetadataCtor + '\n' +
        '  setActionHandler = ' + f.setActionHandler + '\n' +
        '  setPositionState = ' + f.setPositionState + '\n' +
        '\n' +
        '【setPositionState 详解】\n' +
        '  setPositionState({ duration, position, playbackRate })\n' +
        '  让 OS UI 显示进度条 / 剩余时间，用户拖动进度条触发 seekto action\n' +
        '  duration —— 总时长（秒，必须 > 0）\n' +
        '  position —— 当前位置（秒，0 ≤ position ≤ duration）\n' +
        '  playbackRate —— 播放速率（默认 1，影响 OS UI 进度条速度）\n' +
        '  应在 timeupdate 事件中更新（节流，避免过频调用）';
    } catch (err: any) {
      return '读取音乐播放器信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _runMusicPlayerDemo() {
    const f = this._flags();
    if (!f.mediaSession) {
      this._addLog('warn', 'navigator.mediaSession 不可用（jsdom 通常不实现），仅展示说明与代码');
    } else {
      try {
        const tracks = [
          { title: 'Song A', artist: 'Artist X', album: 'Album 1' },
          { title: 'Song B', artist: 'Artist Y', album: 'Album 2' },
          { title: 'Song C', artist: 'Artist Z', album: 'Album 3' },
        ];
        const t = tracks[this._playerTrackIndex % tracks.length];
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title, artist: t.artist, album: t.album,
        });
        navigator.mediaSession.playbackState = (this._playerState as MediaSessionPlaybackState);
        this._addLog('info', '已设置音乐播放器 metadata + playbackState（' + t.title + ' / ' + this._playerState + '）');
      } catch (err: any) {
        this._addLog('warn', '设置失败：' + err.name + ' - ' + err.message);
      }
    }
    this.setState({ musicPlayerInfo: this._readMusicPlayerInfo() });
  }

  _playerTogglePlay() {
    this._playerState = this._playerState === 'playing' ? 'paused' : 'playing';
    const f = this._flags();
    if (f.playbackState) {
      try { navigator.mediaSession.playbackState = (this._playerState as MediaSessionPlaybackState); } catch (e: any) { /* noop */ }
    }
    this._addLog('player', '播放器切换：' + this._playerState);
    this.setState({ musicPlayerInfo: this._readMusicPlayerInfo() });
  }

  _playerNext() {
    this._playerTrackIndex = (this._playerTrackIndex + 1) % 3;
    this._addLog('player', '下一曲 → 索引 ' + this._playerTrackIndex);
    this._runMusicPlayerDemo();
  }

  _playerPrev() {
    this._playerTrackIndex = (this._playerTrackIndex - 1 + 3) % 3;
    this._addLog('player', '上一曲 → 索引 ' + this._playerTrackIndex);
    this._runMusicPlayerDemo();
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const trackNames = ['Song A · Artist X', 'Song B · Artist Y', 'Song C · Artist Z'];
    const currentTrack = trackNames[this._playerTrackIndex % 3];
    const card = new Card({
      title: '6. 实战：音乐播放器集成 —— audio + MediaMetadata + setActionHandler',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['mediaSession', f.mediaSession],
          ['setPositionState', f.setPositionState],
        ]),
        h(Tag, { color: 'primary' }, '锁屏 / 通知栏'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'HTMLAudioElement + MediaMetadata + setActionHandler 全套集成：loadTrack 函数同时设置 audio.src、播放、new MediaMetadata（锁屏 / 通知栏显示）。监听 play/pause 同步 playbackState，ended 自动下一曲。注册 play/pause/previoustrack/nexttrack/seekbackward/seekforward/seekto 全套 handler。setPositionState 让 OS UI 显示进度条（duration/position/playbackRate），用户拖动触发 seekto action。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行播放器演示', { type: 'primary', size: 'sm', onClick: () => this._runMusicPlayerDemo() }),
        ),
        h('div', { class: 'ms-player' },
          h('div', { class: 'track' },
            h('div', { class: 'cover' }, '♪'),
            h('div', { class: 'meta' },
              h('div', { class: 'title' }, currentTrack.split(' · ')[0]),
              h('div', { class: 'artist' }, currentTrack.split(' · ')[1] + ' · 索引 ' + this._playerTrackIndex),
            ),
          ),
          h('div', { class: 'controls' },
            h('div', { class: 'ctrl-btn', onClick: () => this._playerPrev() }, '⏮'),
            h('div', { class: 'ctrl-btn main', onClick: () => this._playerTogglePlay() },
              this._playerState === 'playing' ? '⏸' : '▶'),
            h('div', { class: 'ctrl-btn', onClick: () => this._playerNext() }, '⏭'),
          ),
          h('div', { style: { textAlign: 'center', fontSize: '11px', color: '#64748b', marginTop: '8px' } },
            '点击控件模拟 OS 媒体键触发（真实浏览器在锁屏 / 通知栏触发）'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.musicPlayerInfo || '（点击「运行播放器演示」查看完整音乐播放器集成代码）')),
        h(Alert, {
          type: 'info',
          message: 'setPositionState 让 OS UI 显示进度条，用户拖动触发 seekto',
          description: 'setPositionState({ duration, position, playbackRate }) 在 timeupdate 事件中更新（节流避免过频）。loadTrack 函数封装"切歌"逻辑：同时更新 audio.src、metadata、playbackState。ended 事件自动加载下一首实现连续播放。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 7：实战：视频播放器与投屏 ===================

  _readVideoCastInfo() {
    const f = this._flags();
    try {
      return '===== 实战：视频播放器与投屏 =====\n' +
        '\n' +
        '【场景】\n' +
        '  video 元素 + Media Session / Chromecast 投屏元数据 /\n' +
        '  与 Picture-in-Picture 协同 / 后台播放控制\n' +
        '\n' +
        '【基础：video 元素 + Media Session】\n' +
        '  与音频场景类似，但视频元数据应包含"视频"语义：\n' +
        '    const video = document.querySelector("video");\n' +
        '    navigator.mediaSession.metadata = new MediaMetadata({\n' +
        '      title: "Movie Title",\n' +
        '      artist: "Director Name",\n' +
        '      album: "Studio",\n' +
        '      artwork: [...],  // 海报多尺寸\n' +
        '    });\n' +
        '\n' +
        '【Chromecast 投屏元数据】\n' +
        '  使用 Presentation API / Chromecast SDK 投屏时：\n' +
        '    Media Session API 的 metadata 会同步到接收端（Chromecast 设备）\n' +
        '    投屏过程中：\n' +
        '      ✓ 投屏控制条显示标题 / 艺术家 / 封面\n' +
        '      ✓ 用户在手机锁屏可控制投屏播放\n' +
        '      ✓ 投屏断开时 playbackState 自动设为 none\n' +
        '  代码：\n' +
        '    const castSession = cast.framework.CastContext.getInstance().getCurrentSession();\n' +
        '    castSession.loadMedia(mediaInfo);  // mediaInfo 包含 metadata\n' +
        '    // Media Session API 自动同步 metadata 到 cast\n' +
        '\n' +
        '【与 Picture-in-Picture 协同】\n' +
        '  Picture-in-Picture (PiP) 让视频浮窗显示在其他应用之上：\n' +
        '    document.pictureInPictureElement  —— 当前 PiP 元素\n' +
        '    video.requestPictureInPicture()   —— 进入 PiP\n' +
        '    document.exitPictureInPicture()   —— 退出 PiP\n' +
        '  与 Media Session 协同：\n' +
        '    PiP 浮窗显示播放控件（play/pause/next 等）\n' +
        '    PiP 控件触发 Media Session action handler\n' +
        '    用户切到其他应用后仍可控制视频播放\n' +
        '  代码：\n' +
        '    btnPip.addEventListener("click", async () => {\n' +
        '      if (document.pictureInPictureElement) {\n' +
        '        await document.exitPictureInPicture();\n' +
        '      } else {\n' +
        '        await video.requestPictureInPicture();\n' +
        '      }\n' +
        '    });\n' +
        '\n' +
        '【后台播放控制】\n' +
        '  页面切到后台（用户切换标签页 / 最小化窗口）时：\n' +
        '    音频：通常继续播放（浏览器策略允许）\n' +
        '    视频：浏览器可能限制（需 Media Session + audio track 才能后台播放视频音频）\n' +
        '  Media Session 让用户在后台 / 锁屏仍能控制：\n' +
        '    document.addEventListener("visibilitychange", () => {\n' +
        '      if (document.hidden && !video.paused) {\n' +
        '        // 后台播放，OS 媒体控件继续可用\n' +
        '        navigator.mediaSession.playbackState = "playing";\n' +
        '      }\n' +
        '    });\n' +
        '\n' +
        '【能力检测】\n' +
        '  mediaSession 可用        = ' + f.mediaSession + '\n' +
        '  MediaMetadata ctor       = ' + f.mediaMetadataCtor + '\n' +
        '  setPositionState         = ' + f.setPositionState + '\n' +
        '  Picture-in-Picture 可用  = ' + (typeof document !== 'undefined' &&
          typeof document.pictureInPictureEnabled === 'boolean') + '\n' +
        '  Presentation API 可用    = ' + (typeof navigator !== 'undefined' &&
          'presentation' in navigator) + '\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  const video = document.querySelector("video");\n' +
        '\n' +
        '  // 设置元数据\n' +
        '  navigator.mediaSession.metadata = new MediaMetadata({\n' +
        '    title: "Big Buck Bunny",\n' +
        '    artist: "Blender Foundation",\n' +
        '    album: "Open Movie",\n' +
        '    artwork: [\n' +
        '      { src: "poster-96.png",  sizes: "96x96",   type: "image/png" },\n' +
        '      { src: "poster-512.png", sizes: "512x512", type: "image/png" },\n' +
        '    ],\n' +
        '  });\n' +
        '\n' +
        '  // 同步 playbackState + setPositionState\n' +
        '  video.addEventListener("play", () => {\n' +
        '    navigator.mediaSession.playbackState = "playing";\n' +
        '  });\n' +
        '  video.addEventListener("timeupdate", () => {\n' +
        '    if (!isFinite(video.duration)) return;\n' +
        '    navigator.mediaSession.setPositionState({\n' +
        '      duration: video.duration,\n' +
        '      position: video.currentTime,\n' +
        '      playbackRate: video.playbackRate,\n' +
        '    });\n' +
        '  });\n' +
        '\n' +
        '  // 注册 action handler\n' +
        '  navigator.mediaSession.setActionHandler("play",  () => video.play());\n' +
        '  navigator.mediaSession.setActionHandler("pause", () => video.pause());\n' +
        '  navigator.mediaSession.setActionHandler("seekto", (details: any) => {\n' +
        '    if (details.seekTime != null) video.currentTime = details.seekTime;\n' +
        '  });\n' +
        '\n' +
        '  // PiP 协同\n' +
        '  btnPip.addEventListener("click", async () => {\n' +
        '    if (document.pictureInPictureElement) {\n' +
        '      await document.exitPictureInPicture();\n' +
        '    } else {\n' +
        '      await video.requestPictureInPicture();\n' +
        '    }\n' +
        '  });';
    } catch (err: any) {
      return '读取视频与投屏信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _runVideoCastDemo() {
    const f = this._flags();
    if (!f.mediaSession) {
      this._addLog('warn', 'navigator.mediaSession 不可用（jsdom 通常不实现），仅展示说明与代码');
    } else {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Big Buck Bunny',
          artist: 'Blender Foundation',
          album: 'Open Movie',
        });
        this._addLog('info', '已设置视频 metadata（Big Buck Bunny）');
      } catch (err: any) {
        this._addLog('warn', '设置失败：' + err.name + ' - ' + err.message);
      }
    }
    this.setState({ videoCastInfo: this._readVideoCastInfo() });
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const pipAvailable = typeof document !== 'undefined' &&
      typeof document.pictureInPictureEnabled === 'boolean';
    const card = new Card({
      title: '7. 实战：视频播放器与投屏 —— video + Chromecast + PiP',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['mediaSession', f.mediaSession],
          ['PiP', pipAvailable],
        ]),
        h(Tag, { color: 'primary' }, '视频 / 投屏 / PiP'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'video 元素 + Media Session：与音频类似但元数据含"视频"语义（海报）。Chromecast 投屏：metadata 自动同步到接收端（Chromecast 设备），投屏控制条显示标题/封面，用户在手机锁屏可控制投屏。与 Picture-in-Picture 协同：PiP 浮窗显示播放控件，触发 Media Session action handler，用户切到其他应用后仍可控制视频。后台播放控制：页面切到后台时通过 visibilitychange 监听 + 设置 playbackState 让 OS 媒体控件继续可用。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行视频与投屏演示', { type: 'primary', size: 'sm', onClick: () => this._runVideoCastDemo() }),
        ),
        h('div', { class: 'ms-video-stage' },
          h('div', { class: 'placeholder' }, '🎬 视频播放区域（演示）'),
          h('div', { class: 'pip-row' },
            h('div', { class: 'ms-state-pill ' + (f.mediaSession ? 'playing' : 'none') },
              h('span', { class: 'dot' }),
              'Media Session ' + (f.mediaSession ? '可用' : '不可用'),
            ),
            h('div', { class: 'ms-state-pill ' + (pipAvailable ? 'playing' : 'none') },
              h('span', { class: 'dot' }),
              'PiP ' + (pipAvailable ? '可用' : '不可用'),
            ),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.videoCastInfo || '（点击「运行视频与投屏演示」查看完整代码）')),
        h(Alert, {
          type: 'info',
          message: 'Media Session 与 PiP / Chromecast 协同，让视频跨应用可控',
          description: 'Chromecast 投屏自动同步 metadata 到接收端；PiP 浮窗控件触发 action handler；后台播放通过 visibilitychange + playbackState 让 OS 媒体控件继续可用。视频场景 setPositionState 让 OS UI 显示进度条，用户拖动触发 seekto。',
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
      return '===== Media Session API 陷阱与最佳实践 =====\n' +
        '\n' +
        '【陷阱 1：artwork 跨域 CORS】\n' +
        '  artwork 图片必须与页面同源或服务器返回正确 CORS 头：\n' +
        '    Access-Control-Allow-Origin: * 或具体 origin\n' +
        '  否则浏览器拒绝加载封面，锁屏 / 通知栏显示默认占位图\n' +
        '  解决：\n' +
        '    1. 同源部署封面图（推荐）\n' +
        '    2. CDN 配置 CORS 头（Access-Control-Allow-Origin）\n' +
        '    3. 用 data URL 内嵌小封面（base64，仅小图可行）\n' +
        '    4. 服务端代理下载跨域图\n' +
        '\n' +
        '【陷阱 2：通知栏占用清理】\n' +
        '  页面卸载时若不清理 metadata + action handler，通知栏会持续显示\n' +
        '    "正在播放"残留（直到浏览器清理或用户手动关闭）\n' +
        '  解决：\n' +
        '    window.addEventListener("beforeunload", () => {\n' +
        '      navigator.mediaSession.metadata = null;\n' +
        '      navigator.mediaSession.playbackState = "none";\n' +
        '      ["play", "pause", "previoustrack", "nexttrack", "seekbackward",\n' +
        '       "seekforward", "seekto", "stop", "skipad"].forEach((a: any) => {\n' +
        '        navigator.mediaSession.setActionHandler(a as any, null);\n' +
        '      });\n' +
        '    });\n' +
        '  也建议在 SPA 路由切换时清理（避免单页应用残留）\n' +
        '\n' +
        '【陷阱 3：setActionHandler null 清除】\n' +
        '  setActionHandler(action, null) 是清除单个 action 的唯一方式\n' +
        '  不能用 setActionHandler(action, undefined)（会被强制转为 null，但语义不清）\n' +
        '  不能用 delete 或 unset（API 不支持）\n' +
        '  注意：某些浏览器对未注册的 action 调用 setActionHandler(action, null) 会抛 NotSupportedError\n' +
        '    解决：try/catch 包裹\n' +
        '\n' +
        '【陷阱 4：移动端电量】\n' +
        '  持续播放 + Media Session 在移动端会显著耗电：\n' +
        '    屏幕常亮（视频场景）+ 网络下载 + OS 通知栏渲染\n' +
        '  解决：\n' +
        '    1. 音频场景暂停时及时设置 playbackState = "paused"（让 OS 关闭常亮）\n' +
        '    2. 视频场景用 Page Visibility API 在后台时降级（如降低码率）\n' +
        '    3. setPositionState 节流（避免 timeupdate 每秒多次调用）\n' +
        '    4. 监听 battery API（如可用）在低电量时提示用户\n' +
        '\n' +
        '【陷阱 5：与 Service Worker Media 集成】\n' +
        '  Service Worker 中无 navigator.mediaSession（仅在 window 上下文可用）\n' +
        '  但 Service Worker 可代理媒体请求（如范围请求 / 缓存）\n' +
        '  集成模式：\n' +
        '    页面：navigator.mediaSession.setActionHandler("play", () => audio.play())\n' +
        '    SW：fetch 事件中代理 audio.src 请求（缓存 / 范围请求）\n' +
        '  注意：SW 不能直接控制 mediaSession，必须 postMessage 到页面\n' +
        '\n' +
        '【陷阱 6：iOS Safari 差异】\n' +
        '  iOS Safari 15+ 支持但有差异：\n' +
        '    ✓ 必须由用户手势触发首次播放（audio.play() 需在 click handler 内）\n' +
        '    ✓ 控制中心显示媒体控件（与 Android 通知栏类似）\n' +
        '    ✗ setPositionState 支持有限（iOS 15.1+ 部分支持）\n' +
        '    ✗ artwork 跨域限制更严格（必须 CORS）\n' +
        '    ✗ 后台音频播放需 <audio> 元素在 DOM 中（不能 new Audio() 不挂载）\n' +
        '  解决：\n' +
        '    1. 首次播放绑定到用户手势（play button click）\n' +
        '    2. <audio> 元素显式插入 document.body（iOS 后台播放要求）\n' +
        '    3. 检测 iOS 后降级处理（如不调用 setPositionState）\n' +
        '\n' +
        '【陷阱 7：无障碍协同】\n' +
        '  Media Session 主要服务视力正常用户（看 OS UI）；视障用户依赖屏幕阅读器\n' +
        '  协同方案：\n' +
        '    1. <audio>/<video> 提供可访问的播放控件（不依赖 Media Session）\n' +
        '    2. aria-label 标注播放按钮（如 "播放 Never Gonna Give You Up"）\n' +
        '    3. 实时播放状态用 aria-live="polite" 通知屏幕阅读器\n' +
        '    4. 键盘等价：空格键 play/pause、方向键 seek（Media Session 不自动提供）\n' +
        '\n' +
        '【最佳实践清单】\n' +
        '  ✓ 必须在 secure context（https 或 localhost）下使用\n' +
        '  ✓ 能力检测：if ("mediaSession" in navigator && window.MediaMetadata)\n' +
        '  ✓ artwork 至少提供 96 / 128 / 192 / 256 / 384 / 512 六档尺寸\n' +
        '  ✓ artwork 同源或配 CORS（避免锁屏 / 通知栏显示占位图）\n' +
        '  ✓ 显式监听 play/pause/ended 同步 playbackState（不依赖浏览器自动同步）\n' +
        '  ✓ setPositionState 在 timeupdate 中节流更新（让 OS UI 显示进度条）\n' +
        '  ✓ 注册全套 action handler（play/pause/prev/next/seek 等）\n' +
        '  ✓ 页面卸载 / SPA 路由切换时清理 metadata + action handler（避免残留）\n' +
        '  ✓ iOS 首次播放绑定用户手势 + <audio> 显式挂载 DOM\n' +
        '  ✓ 移动端注意电量（暂停时及时设 playbackState = "paused"）\n' +
        '  ✓ 与无障碍协同：可访问控件 + aria-label + 键盘等价\n' +
        '\n' +
        '【能力检测汇总】\n' +
        '  mediaSession       = ' + f.mediaSession + '\n' +
        '  MediaMetadata ctor = ' + f.mediaMetadataCtor + '\n' +
        '  setActionHandler   = ' + f.setActionHandler + '\n' +
        '  setPositionState   = ' + f.setPositionState + '\n' +
        '  isSecureContext    = ' + f.isSecureContext;
    } catch (err: any) {
      return '读取陷阱与最佳实践信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _runPitfallsDemo() {
    this.setState({ pitfallsInfo: this._readPitfallsInfo() });
    const f = this._flags();
    this._addLog('pitfalls', '陷阱与最佳实践演示完成；mediaSession=' + f.mediaSession + ', setPositionState=' + f.setPositionState);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 陷阱与最佳实践 —— CORS / 清理 / iOS / 电量 / 无障碍',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['mediaSession', f.mediaSession],
          ['secure', f.isSecureContext],
        ]),
        h(Tag, { color: 'warning' }, '7 大陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '七大陷阱：artwork 跨域 CORS（必须同源或配 Access-Control-Allow-Origin）；通知栏占用清理（页面卸载 reset metadata + action handler）；setActionHandler null 清除（try/catch 包裹未注册 action）；移动端电量（暂停时设 playbackState = "paused" + setPositionState 节流）；与 Service Worker Media 集成（SW 中无 mediaSession，需 postMessage 到页面）；iOS Safari 差异（首次播放需用户手势 + audio 显式挂载 DOM）；无障碍协同（aria-label + 键盘等价 + aria-live）。最佳实践清单 11 条覆盖安全上下文、能力检测、artwork 多尺寸、CORS、playbackState 同步、setPositionState 节流、action handler 全套、清理生命周期、iOS 兼容、电量优化、无障碍协同。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', onClick: () => this._runPitfallsDemo() }),
        ),
        h('div', { class: 'ms-output' },
          '页面卸载清理示例：\n' +
          'window.addEventListener("beforeunload", () => {\n' +
          '  navigator.mediaSession.metadata = null;\n' +
          '  navigator.mediaSession.playbackState = "none";\n' +
          '  ["play","pause","previoustrack","nexttrack",\n' +
          '   "seekbackward","seekforward","seekto","stop","skipad"]\n' +
          '    .forEach((a: any) => navigator.mediaSession.setActionHandler(a as any, null));\n' +
          '});'),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看 7 大陷阱与 11 条最佳实践完整说明）')),
        h(Alert, {
          type: 'warning',
          message: '页面卸载必须清理 metadata + action handler，避免通知栏残留',
          description: '七大陷阱：CORS（artwork 同源或配头）、清理（beforeunload reset）、null 清除（try/catch）、电量（暂停设 playbackState）、SW 集成（postMessage）、iOS 差异（用户手势 + audio 挂载 DOM）、无障碍（aria-label + 键盘等价）。最佳实践 11 条覆盖安全上下文、能力检测、artwork 多尺寸、CORS、playbackState 同步、setPositionState 节流、清理生命周期、iOS 兼容、电量优化、无障碍协同。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
    const s = this.state;
    const reversed = [...s.logs].reverse();   // 按时间倒序：最新日志在最上方
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志（按时间倒序）',
        h(Tag, { color: 'primary' }, s.logs.length + ' 条'),
      ),
      reversed.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : reversed.map((log: any) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: 'log-panel__tag log-panel__tag--' + log.type }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 渲染入口 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page media-session-page' },
      h('h2', { class: 'section-title' }, 'Media Session API 媒体会话完整实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 W3C Media Session API 全套能力：OS 级媒体控制集成（锁屏 / 通知栏 / 硬件键）、navigator.mediaSession 入口与安全上下文、MediaMetadata 元数据（title/artist/album/artwork 多尺寸封面）、playbackState 状态联动、setActionHandler 9 大动作（play/pause/prev/next/seekbackward/seekforward/seekto/stop/skipad）、音乐播放器集成（audio + setPositionState 进度条）、视频与投屏（Chromecast + Picture-in-Picture + 后台播放）、陷阱与最佳实践（CORS / 清理 / iOS / 电量 / 无障碍）。所有特性通过 safe 能力检测，不可用时仅记日志，绝不抛异常。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
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
