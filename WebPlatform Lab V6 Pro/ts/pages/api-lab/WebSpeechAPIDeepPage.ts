// =====================================================================
// WebSpeechAPIDeepPage.js —— Web Speech API 语音合成与识别深度实验室
// 演示 W3C Web Speech API 两大子能力（与 SpeechCodecsPage 的编解码内容互补，
// 本页专注语音合成 TTS + 语音识别 ASR，不重复 AudioDecoder/Encoder 编解码）：
//   1. SpeechSynthesis（TTS 文本转语音，W3C Web Speech API）
//      window.speechSynthesis 单例 + new SpeechSynthesisUtterance(text)
//      speak/cancel/pause/resume + pending/speaking/paused 状态
//      utterance.text/lang/pitch/rate/volume/voice + 8 个事件
//   2. SpeechSynthesisVoice 语音选择深潜
//      name/lang/voiceURI/localService/default + getVoices + voiceschanged
//      按 lang/localService 筛选，跨平台 voice 差异（Windows SAPI / macOS NSSpeechSynthesizer）
//   3. SpeechSynthesis 队列与节奏控制
//      speak() 自动队列 + rate(0.1-10)/pitch(0-2)/volume(0-1)
//      长文本分句 + boundary 词边界 + mark/SSML + 卡拉OK 高亮
//   4. SpeechRecognition（ASR 语音转文本，webkitSpeechRecognition 前缀居多）
//      recognition.lang/continuous/interimResults/maxAlternatives
//      start/stop/abort + 8 个事件 + onerror 错误类型
//   5. SpeechRecognitionEvent / SpeechRecognitionResult
//      results 类数组 + isFinal + transcript/confidence + resultIndex
//      continuous + interimResults 实时字幕
//   6. SpeechGrammarList + JSGF 语法约束
//      addFromString/addFromURI + weight + 限定词汇集提升准确率
//   7. 实战模式与陷阱清单
//      语音助手闭环 / 语音搜索 / 无障碍朗读 / 离线识别 WASM
//      9 大陷阱 + 降级方案（Web Audio + MediaRecorder + 服务端 ASR）
// 说明：Web Speech API 仅在真实浏览器中可用（Chrome/Edge 全支持、Safari 部分、
//       Firefox 默认禁用需 flag）。jsdom/Node 环境 typeof 检测全部为 false，
//       所有 API 调用前做能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { State } from '../../core/types.js';

interface WebSpeechAPIDeepPageState extends State {
  logs: any;
  capsSummary: any;
  overviewInfo: any;
  synthBasicInfo: any;
  voiceInfo: any;
  synthControlInfo: any;
  recogBasicInfo: any;
  resultInfo: any;
  grammarInfo: any;
  patternInfo: any;
}

export class WebSpeechAPIDeepPage extends Page {
  declare state: WebSpeechAPIDeepPageState;
  _dynamicStyles!: any[];
  _inited!: boolean;

  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',      // Card 1：Web Speech API 概述与能力检测
      synthBasicInfo: '',    // Card 2：SpeechSynthesis 合成基础与 utterance
      voiceInfo: '',         // Card 3：SpeechSynthesisVoice 语音选择深潜
      synthControlInfo: '',  // Card 4：SpeechSynthesis 实战：队列与节奏控制
      recogBasicInfo: '',    // Card 5：SpeechRecognition 识别基础
      resultInfo: '',        // Card 6：SpeechRecognitionEvent 与 SpeechRecognitionResult
      grammarInfo: '',       // Card 7：SpeechGrammarList 与语法约束
      patternInfo: '',       // Card 8：实战模式与陷阱
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `speechSynthesis ${c(f.speechSynthesis)}`,
      `SpeechSynthesisUtterance ${c(f.speechSynthesisUtterance)}`,
      `SpeechRecognition ${c(f.speechRecognition)}`,
      `SpeechGrammarList ${c(f.speechGrammarList)}`,
    ];

    const any = f.speechSynthesis || f.speechRecognition;
    const summary = any
      ? `Web Speech API 能力检测：${parts.join(' · ')}。当前环境部分支持，TTS 演示可真实发声，ASR 演示需 HTTPS/localhost 与麦克风权限。`
      : `Web Speech API 能力检测：${parts.join(' · ')}。jsdom/Node 环境无 speechSynthesis/SpeechRecognition，所有按钮点击仅记日志说明，不会抛异常；真实浏览器（Chrome/Edge）可完整体验。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.speechSynthesis) this._addLog('warn', 'speechSynthesis 不可用（jsdom 无 TTS，真实浏览器需 Chrome/Edge/Safari）');
    if (!f.speechSynthesisUtterance) this._addLog('warn', 'SpeechSynthesisUtterance 不可用');
    if (!f.speechRecognition) this._addLog('warn', 'SpeechRecognition 不可用（需 webkit 前缀，Chrome/Edge 支持，Firefox 默认禁用需 flag）');
    if (!f.speechGrammarList) this._addLog('warn', 'SpeechGrammarList 不可用（Chrome 部分支持）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
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

  _injectBaseStyles() {
    this._injectStyle('ws-base', `
      .ws-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .ws-voice-list {
        margin-top: 10px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
      }
      .ws-voice-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 12px;
      }
      .ws-voice-item:last-child { border-bottom: none; }
      .ws-voice-name { font-weight: 600; color: #1e293b; min-width: 150px; }
      .ws-voice-lang { color: #3b82f6; font-family: monospace; min-width: 70px; }
      .ws-voice-tag {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 8px;
        font-weight: 600;
      }
      .ws-voice-tag--local { background: #dcfce7; color: #166534; }
      .ws-voice-tag--cloud { background: #fef3c7; color: #92400e; }
      .ws-voice-tag--default { background: #dbeafe; color: #1e40af; }
      .ws-waveform {
        display: flex;
        align-items: center;
        gap: 3px;
        height: 48px;
        padding: 8px 12px;
        background: #0f172a;
        border-radius: 6px;
        margin-top: 10px;
      }
      .ws-wave-bar {
        width: 4px;
        background: linear-gradient(180deg, #3b82f6, #8b5cf6);
        border-radius: 2px;
        animation: ws-wave 1s ease-in-out infinite;
      }
      @keyframes ws-wave {
        0%, 100% { height: 8px; }
        50% { height: 36px; }
      }
      .ws-mic {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ef4444, #f59e0b);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 24px;
        margin: 8px;
        animation: ws-mic-pulse 1.5s ease-in-out infinite;
      }
      @keyframes ws-mic-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        50% { box-shadow: 0 0 0 14px rgba(239, 68, 68, 0); }
      }
      .ws-status {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .ws-status--ok { background: #dcfce7; color: #166534; }
      .ws-status--no { background: #fee2e2; color: #991b1b; }
      .ws-status--run { background: #dbeafe; color: #1e40af; }
      .ws-caption {
        margin-top: 10px;
        padding: 10px;
        background: #f1f5f9;
        border-left: 3px solid #3b82f6;
        border-radius: 4px;
        font-size: 13px;
        min-height: 20px;
        color: #1e293b;
      }
      .ws-caption .ws-interim { color: #64748b; font-style: italic; }
      .ws-caption .ws-final { color: #0f172a; font-weight: 500; }
      .ws-karaoke {
        margin-top: 10px;
        padding: 12px;
        background: #fef3c7;
        border-radius: 6px;
        font-size: 14px;
        line-height: 1.8;
      }
      .ws-karaoke .ws-word { transition: background 0.15s ease, color 0.15s ease; padding: 0 2px; border-radius: 3px; }
      .ws-karaoke .ws-word--active { background: #f59e0b; color: #fff; }
      .ws-output {
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
      .ws-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
  }

  _flags() {
    const safe = (fn: any) => {
      try { return fn(); } catch { return false; }
    };
    return {
      speechSynthesis: safe(() => 'speechSynthesis' in window),
      speechSynthesisUtterance: safe(() => 'SpeechSynthesisUtterance' in window),
      speechRecognition: safe(() => ('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window)),
      speechGrammarList: safe(() => 'SpeechGrammarList' in window),
    };
  }

  // ===================== Card 1：Web Speech API 概述与能力检测 =====================

  _runOverviewDemo() {
    const f = this._flags();
    this._injectStyle('ws-overview-demo', `
      .ws-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
      .ws-matrix { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-top: 10px; }
      .ws-matrix-cell { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 12px; }
    `);
    const info = [
      '===== Web Speech API 概述与能力检测 =====',
      '',
      '【两大子能力】',
      '  1. SpeechSynthesis（TTS，文本转语音）',
      '     - W3C Web Speech API 规范的合成部分',
      '     - window.speechSynthesis 单例对象（无需 new）',
      '     - new SpeechSynthesisUtterance(text) 创建话语',
      '     - 浏览器原生合成，无需服务端',
      '     - Chrome/Edge/Safari 均支持，Firefox 部分支持',
      '',
      '  2. SpeechRecognition（ASR，语音转文本）',
      '     - W3C Web Speech API 规范的识别部分',
      '     - new SpeechRecognition() 或 new webkitSpeechRecognition()',
      '     - webkit 前缀居多（Chrome/Edge/Safari）',
      '     - Chrome 走 Google 云服务识别（需联网）',
      '     - Firefox 默认禁用需 about:config 开启 flag',
      '',
      '【能力检测代码】',
      "  // TTS 合成能力检测",
      "  const ttsOK = 'speechSynthesis' in window",
      "             && 'SpeechSynthesisUtterance' in window;",
      '',
      "  // ASR 识别能力检测（需兼容 webkit 前缀）",
      "  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;",
      "  const asrOK = typeof SR === 'function';",
      '',
      "  // 语法约束检测",
      "  const grammarOK = 'SpeechGrammarList' in window;",
      '',
      '【浏览器支持矩阵】',
      '  浏览器        TTS 合成      ASR 识别       GrammarList',
      '  Chrome        ✓ 全支持      ✓ 云端识别     ✓ 部分支持',
      '  Edge          ✓ 全支持      ✓ 云端识别     ✓ 部分支持',
      '  Safari        ✓ 支持        ✓ iOS 14.5+    ✗ 不支持',
      '  Firefox       ✓ 部分支持    ✗ 默认禁用     ✗ 不支持',
      '  移动端 Chrome ✓ 支持        ✓ 支持         ✓ 部分支持',
      '  移动端 Safari ✓ 支持        ✓ iOS 14.5+    ✗ 不支持',
      '',
      '【安全上下文要求】',
      '  - 必须 HTTPS 或 localhost（含 127.0.0.1）',
      '  - http:// 非 localhost 会被浏览器拒绝（ASR 尤其严格）',
      '  - file:// 协议部分浏览器允许，部分拒绝',
      '  - 检测：window.isSecureContext 返回 true',
      '',
      '【用户权限要求】',
      '  - TTS 合成：无需权限（直接发声）',
      '  - ASR 识别：需麦克风权限（Permissions API: microphone）',
      '  - 首次调用 recognition.start() 会弹出权限请求',
      '  - 权限被拒绝时 onerror 触发 error: not-allowed',
      '  - 必须由用户激活（用户手势触发，不能页面加载自动启动）',
      '',
      '【与 Web Audio API 的区别】',
      '  Web Speech API（高层）：',
      '    - text → 语音（TTS）/ 语音 → text（ASR）',
      '    - 浏览器封装底层处理，开发者只关心文本',
      '    - 不可控底层音频流、采样率、编码',
      '',
      '  Web Audio API（底层）：',
      '    - AudioContext / AudioNode / AnalyserNode 等图结构',
      '    - 处理原始音频流（增益、滤波、混响、频谱分析）',
      '    - 配合 MediaStream / MediaRecorder 录制原始音频',
      '    - 不做语音识别/合成，需自行接 ASR/TTS 服务',
      '',
      '【与 WebCodecs 的区别（SpeechCodecsPage 已覆盖）】',
      '  WebCodecs：AudioEncoder/Decoder 编解码原始音频帧（Opus/AAC/FLAC）',
      '  Web Speech：高层语音语义 API（文本↔语音），不做编解码',
      '',
      '【实际能力检测演示】',
      `  speechSynthesis: ${f.speechSynthesis ? '✓' : '✗'}`,
      `  SpeechSynthesisUtterance: ${f.speechSynthesisUtterance ? '✓' : '✗'}`,
      `  SpeechRecognition: ${f.speechRecognition ? '✓' : '✗'}`,
      `  SpeechGrammarList: ${f.speechGrammarList ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. ASR 必须用户手势激活，不能页面加载自动 start()',
      '  2. Firefox ASR 默认禁用，需 media.webspeech.recognition.enable=true',
      '  3. iOS Safari ASR 需 14.5+，且需用户交互',
      '  4. Chrome ASR 走 Google 云，离线不可用，隐私敏感场景慎用',
      '  5. TTS 在某些浏览器需 voiceschanged 后才有 voice 列表',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('speech', `能力检测完成：TTS=${f.speechSynthesis}/${f.speechSynthesisUtterance}，ASR=${f.speechRecognition}，Grammar=${f.speechGrammarList}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. Web Speech API 概述与能力检测 —— 两大子能力与浏览器支持',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['TTS', f.speechSynthesis],
          ['ASR', f.speechRecognition],
        ]),
        h(Tag, { color: 'primary' }, '概述'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Web Speech API 两大子能力：SpeechSynthesis（TTS 合成，window.speechSynthesis 单例 + SpeechSynthesisUtterance）与 SpeechRecognition（ASR 识别，webkitSpeechRecognition 前缀居多）。用 \'speechSynthesis\' in window 检测 TTS、(\'SpeechRecognition\' in window) || (\'webkitSpeechRecognition\' in window) 检测 ASR。浏览器支持：Chrome/Edge 全支持、Safari 部分支持、Firefox 默认禁用需 flag。必须 HTTPS 或 localhost，ASR 需麦克风权限且需用户激活。Web Speech 是高层 API，Web Audio 是底层音频处理。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行能力检测演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// TTS 合成能力检测
const ttsOK = 'speechSynthesis' in window
           && 'SpeechSynthesisUtterance' in window;

// ASR 识别能力检测（兼容 webkit 前缀）
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const asrOK = typeof SR === 'function';

// 安全上下文检测（ASR 必须 HTTPS 或 localhost）
console.log('isSecureContext:', window.isSecureContext);

// 麦克风权限检测（Permissions API）
navigator.permissions.query({ name: 'microphone' } as any)
  .then((r: any) => console.log('mic permission:', r.state));`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 Web Speech API 概述与能力检测完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：SpeechSynthesis 合成基础与 utterance =====================

  _runSynthBasicDemo() {
    const f = this._flags();
    this._injectStyle('ws-synth-basic-demo', `
      .ws-synth-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    // 尝试真实朗读（jsdom 不可用，仅记日志）
    if (f.speechSynthesis && f.speechSynthesisUtterance) {
      try {
        const u = new SpeechSynthesisUtterance('你好，这是 Web Speech API 语音合成演示。');
        u.lang = 'zh-CN';
        u.rate = 1;
        u.pitch = 1;
        u.volume = 1;
        u.onstart = () => this._addLog('info', 'TTS 朗读开始 onstart');
        u.onend = () => this._addLog('info', 'TTS 朗读结束 onend');
        u.onerror = (e: any) => this._addLog('warn', `TTS 朗读错误 onerror: ${e.error}`);
        window.speechSynthesis.speak(u);
        this._addLog('info', 'TTS 朗读已触发：你好，这是 Web Speech API 语音合成演示。');
      } catch (err: any) {
        this._addLog('warn', `TTS 朗读失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'speechSynthesis 不可用，跳过真实朗读（jsdom 无 TTS）');
    }
    const info = [
      '===== SpeechSynthesis 合成基础与 utterance =====',
      '',
      '【window.speechSynthesis 单例对象】',
      '  // 无需 new，全局单例',
      '  const synth = window.speechSynthesis;',
      '',
      '  // 核心方法',
      '  synth.speak(utterance);   // 将 utterance 加入队列播放',
      '  synth.cancel();           // 清空整个队列，停止所有朗读',
      '  synth.pause();            // 暂停当前朗读（保留队列）',
      '  synth.resume();           // 恢复暂停的朗读',
      '  synth.getVoices();        // 返回 SpeechSynthesisVoice[] 可用语音',
      '',
      '  // 状态属性（只读布尔）',
      '  synth.pending;   // 队列中还有未开始的 utterance',
      '  synth.speaking;  // 正在朗读（至少一个 utterance 进行中）',
      '  synth.paused;    // 已暂停',
      '',
      '【new SpeechSynthesisUtterance(text) 创建话语】',
      '  const u = new SpeechSynthesisUtterance("你好世界");',
      '  // 或先创建再设 text',
      '  const u2 = new SpeechSynthesisUtterance();',
      '  u2.text = "Hello World";',
      '',
      '【utterance 属性】',
      '  u.text     = "要朗读的文本";        // 字符串',
      '  u.lang     = "zh-CN";              // BCP 47 语言标签',
      '  u.pitch    = 1;                    // 音调 0-2，默认 1',
      '  u.rate     = 1;                    // 语速 0.1-10，默认 1',
      '  u.volume   = 1;                    // 音量 0-1，默认 1',
      '  u.voice    = selectedVoice;        // SpeechSynthesisVoice 对象',
      '',
      '【utterance 事件（8 个）】',
      '  u.onstart      = (e: any) => {};  // 朗读开始',
      '  u.onend        = (e: any) => {};  // 朗读结束（正常或被 cancel）',
      '  u.onerror      = (e: any) => {};  // 朗读出错，e.error 含错误类型',
      '  u.onpause      = (e: any) => {};  // 被 pause() 暂停',
      '  u.onresume     = (e: any) => {};  // 被 resume() 恢复',
      '  u.onmark        = (e: any) => {};  // SSML <mark> 标记触发，e.markName',
      '  u.onboundary    = (e: any) => {};  // 词/句边界触发',
      '  // e.charIndex   边界字符索引',
      '  // e.name         "word" 或 "sentence"',
      '  // e.charLength   当前词长度（部分浏览器）',
      '',
      '【speak() 自动队列】',
      '  const u1 = new SpeechSynthesisUtterance("第一句");',
      '  const u2 = new SpeechSynthesisUtterance("第二句");',
      '  synth.speak(u1);  // 立即开始朗读',
      '  synth.speak(u2);  // 加入队列，u1 结束后自动朗读',
      '  // 多个 utterance 顺序播放，无需手动衔接',
      '',
      '【cancel() / pause() / resume()】',
      '  synth.cancel();   // 清空队列 + 停止当前，触发 onend',
      '  synth.pause();    // 暂停当前（onpause 触发）',
      '  synth.resume();   // 恢复（onresume 触发）',
      '  // 注意：pause/resume 在 Chrome 上曾有 bug，需 setTimeout 延迟',
      '',
      '【getVoices() 与 voiceschanged 事件（异步加载）】',
      '  let voices = synth.getVoices();',
      '  console.log(voices.length);  // 首次可能为 0！',
      '',
      '  // 语音列表异步加载，监听 voiceschanged',
      '  synth.addEventListener("voiceschanged", () => {',
      '    voices = synth.getVoices();',
      '    console.log("语音已加载", voices.length);',
      '  });',
      '',
      '  // 兼容写法：先取一次，再监听',
      '  voices = synth.getVoices();',
      '  if (voices.length === 0) {',
      '    synth.onvoiceschanged = () => {',
      '      voices = synth.getVoices();',
      '    };',
      '  }',
      '',
      '【最简朗读示例】',
      '  function speak(text) {',
      '    const u = new SpeechSynthesisUtterance(text);',
      '    u.lang = "zh-CN";',
      '    u.rate = 1;',
      '    window.speechSynthesis.speak(u);',
      '  }',
      '  speak("你好，世界");',
      '',
      '【浏览器支持】',
      `  speechSynthesis: ${f.speechSynthesis ? '✓' : '✗'} (Chrome/Edge/Safari/Firefox 部分)`,
      `  SpeechSynthesisUtterance: ${f.speechSynthesisUtterance ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 首次 getVoices() 返回空数组，必须监听 voiceschanged',
      '  2. Chrome 长文本朗读可能被截断（>15 秒），需分句队列',
      '  3. cancel() 会中断所有 utterance（包括队列中未开始的）',
      '  4. pause()/resume() 在 Chrome 早期版本有 bug，可能无法恢复',
      '  5. 不设 lang 会用系统默认语音，多语言文本可能发音异常',
      '  6. 必须用户激活后才能 speak()（部分浏览器限制自动播放）',
    ].join('\n');
    this.setState({ synthBasicInfo: info });
    this._addLog('speech', `SpeechSynthesis 合成基础演示完成；supports=${f.speechSynthesis}/${f.speechSynthesisUtterance}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. SpeechSynthesis 合成基础与 utterance —— TTS 核心 API',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['speechSynthesis', f.speechSynthesis],
          ['Utterance', f.speechSynthesisUtterance],
        ]),
        h(Tag, { color: 'primary' }, 'TTS 基础'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'window.speechSynthesis 单例对象，speak(utterance)/cancel()/pause()/resume() 方法 + pending/speaking/paused 状态。new SpeechSynthesisUtterance(text) 创建话语，属性 text/lang/pitch(0-2)/rate(0.1-10)/volume(0-1)/voice。8 个事件：onstart/onend/onerror/onpause/onresume/onmark/onboundary（word boundary 词边界）。getVoices() 获取可用语音，voiceschanged 事件处理异步加载。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('朗读示例文本', { type: 'primary', size: 'sm', onClick: () => this._runSynthBasicDemo() }),
        ),
        h('div', { class: 'ws-waveform' },
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.1s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.2s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.3s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.4s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.5s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.6s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.7s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.8s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.9s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.2s' } }),
          h('div', { class: 'ws-wave-bar', style: { animationDelay: '0.4s' } }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const synth = window.speechSynthesis;
const u = new SpeechSynthesisUtterance('你好，世界');
u.lang = 'zh-CN';
u.rate = 1;      // 语速 0.1-10
u.pitch = 1;     // 音调 0-2
u.volume = 1;    // 音量 0-1

u.onstart = () => console.log('开始朗读');
u.onend = () => console.log('朗读结束');
u.onboundary = (e: any) => {
  console.log('词边界', e.charIndex, e.name); // "word"
};

synth.speak(u);   // 加入队列播放
// synth.cancel();  // 清空队列停止
// synth.getVoices(); // 获取可用语音（首次可能为空）`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.synthBasicInfo || '（点击按钮查看 SpeechSynthesis 合成基础完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：SpeechSynthesisVoice 语音选择深潜 =====================

  _runVoiceDemo() {
    const f = this._flags();
    this._injectStyle('ws-voice-demo', `
      .ws-voice-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (f.speechSynthesis) {
      try {
        const voices = window.speechSynthesis.getVoices();
        this._addLog('info', `当前可用语音数量：${voices.length}（首次可能为 0，需 voiceschanged）`);
      } catch (err: any) {
        this._addLog('warn', `getVoices 失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'speechSynthesis 不可用，无法获取真实语音列表（jsdom 无 TTS）');
    }
    const info = [
      '===== SpeechSynthesisVoice 语音选择深潜 =====',
      '',
      '【SpeechSynthesisVoice 对象属性】',
      '  voice.name         // 语音名称（如 "Microsoft Huihui"）',
      '  voice.lang         // BCP 47 语言标签（如 "zh-CN"）',
      '  voice.voiceURI     // 唯一标识（用于选择/持久化）',
      '  voice.localService // true=本地引擎，false=云端服务',
      '  voice.default      // 是否系统默认语音',
      '',
      '【getVoices() 返回 Voice 数组】',
      '  const voices = window.speechSynthesis.getVoices();',
      '  voices.forEach((v: any) => {',
      '    console.log(v.name, v.lang, v.localService, v.default);',
      '  });',
      '',
      '【按 lang 筛选】',
      '  const zhVoices = voices.filter((v: any) => v.lang.startsWith("zh"));',
      '  const zhCN = voices.filter((v: any) => v.lang === "zh-CN");',
      '  const enUS = voices.filter((v: any) => v.lang === "en-US");',
      '  const jaJP = voices.filter((v: any) => v.lang === "ja-JP");',
      '',
      '【按 localService 筛选（本地 vs 云端）】',
      '  // 本地语音：无网络延迟，离线可用',
      '  const local = voices.filter((v: any) => v.localService);',
      '  // 云端语音：质量可能更高，但需联网且有延迟',
      '  const cloud = voices.filter((v: any) => !v.localService);',
      '',
      '【utterance.voice = selectedVoice 设置】',
      '  const u = new SpeechSynthesisUtterance("你好");',
      '  const zhVoice = voices.find((v: any) => v.lang === "zh-CN");',
      '  if (zhVoice) u.voice = zhVoice;  // 指定语音',
      '  u.lang = zhVoice ? zhVoice.lang : "zh-CN";  // 同步 lang',
      '  window.speechSynthesis.speak(u);',
      '',
      '【voice 加载时机（关键）】',
      '  // 首次 getVoices() 可能返回空数组（异步加载）',
      '  let voices = window.speechSynthesis.getVoices();',
      '  if (voices.length === 0) {',
      '    // 监听 voiceschanged 事件',
      '    window.speechSynthesis.addEventListener("voiceschanged", () => {',
      '      voices = window.speechSynthesis.getVoices();',
      '      console.log("语音加载完成", voices.length);',
      '    }, { once: true });',
      '  }',
      '',
      '【不同操作系统/浏览器 voice 差异】',
      '  Windows：',
      '    - 基于 SAPI5（Microsoft Speech API）',
      '    - 常见：Microsoft Huihui (zh-CN)、Microsoft David (en-US)',
      '    - 可在「设置 → 时间和语言 → 语音」安装更多语音',
      '',
      '  macOS：',
      '    - 基于 NSSpeechSynthesizer / AVSpeechSynthesizer',
      '    - 常见：Ting-Ting (zh-CN)、Samantha (en-US)、Kyoko (ja-JP)',
      '    - 可在「系统偏好设置 → 辅助功能 → 语音」管理',
      '',
      '  Android：',
      '    - 基于 Google TTS 引擎',
      '    - 常见：Google 普通话（中国）、Google US English',
      '    - 可在「设置 → 语言和输入 → 文字转语音输出」配置',
      '',
      '  Linux：',
      '    - 通常无原生 voice，需安装 espeak/festival',
      '    - Chrome Linux 部分支持',
      '',
      '  Chrome 云端 voice：',
      '    - 名称含 "Google" 前缀（如 Google 普通话）',
      '    - localService: false，需联网',
      '    - 质量通常优于本地',
      '',
      '【实战：多语言切换】',
      '  function speakIn(text, lang) {',
      '    const voices = window.speechSynthesis.getVoices();',
      '    const voice = voices.find((v: any) => v.lang === lang) ||',
      '                  voices.find((v: any) => v.lang.startsWith(lang.split("-")[0]));',
      '    const u = new SpeechSynthesisUtterance(text);',
      '    u.voice = voice;',
      '    u.lang = lang;',
      '    window.speechSynthesis.speak(u);',
      '  }',
      '  speakIn("你好", "zh-CN");',
      '  speakIn("Hello", "en-US");',
      '  speakIn("こんにちは", "ja-JP");',
      '',
      '【实战：voice 偏好持久化】',
      '  // 保存偏好（用 voiceURI 作为唯一标识）',
      '  function saveVoicePreference(voice) {',
      '    localStorage.setItem("preferred-voice", voice.voiceURI);',
      '  }',
      '',
      '  // 读取偏好',
      '  function getPreferredVoice() {',
      '    const uri = localStorage.getItem("preferred-voice");',
      '    const voices = window.speechSynthesis.getVoices();',
      '    return voices.find((v: any) => v.voiceURI === uri) || voices.find((v: any) => v.default);',
      '  }',
      '',
      '【浏览器支持】',
      `  speechSynthesis: ${f.speechSynthesis ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 首次 getVoices() 返回空，必须监听 voiceschanged',
      '  2. voice.voiceURI 在不同设备不同，不能硬编码',
      '  3. Safari 与 Chrome 的 voice name 差异大，跨浏览器不能假设',
      '  4. localService=false 的云端 voice 在离线时不可用',
      '  5. 设置 u.voice 后仍建议同步 u.lang，部分浏览器依 lang 选择',
      '  6. voice 列表可能因系统语言包安装而变化',
    ].join('\n');
    this.setState({ voiceInfo: info });
    this._addLog('speech', `SpeechSynthesisVoice 语音选择演示完成；supports=${f.speechSynthesis}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. SpeechSynthesisVoice 语音选择深潜 —— 多语言与本地/云端',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['getVoices', f.speechSynthesis]]),
        h(Tag, { color: 'primary' }, 'Voice 深潜'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'SpeechSynthesisVoice 属性：name/lang/voiceURI/localService（本地 vs 云端）/default。getVoices() 返回 Voice 数组，按 lang 筛选（zh-CN/en-US/ja-JP），按 localService 筛选本地无网络延迟。utterance.voice = selectedVoice 设置。voice 加载时机：首次 getVoices 可能空，监听 voiceschanged。不同 OS/浏览器 voice 差异：Windows SAPI、macOS NSSpeechSynthesizer、Android Google TTS。实战：多语言切换、voice 偏好持久化（localStorage 存 voiceURI）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('获取语音列表', { type: 'primary', size: 'sm', onClick: () => this._runVoiceDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '语音列表示例（mock）：'),
        h('div', { class: 'ws-voice-list' },
          h('div', { class: 'ws-voice-item' },
            h('span', { class: 'ws-voice-name' }, 'Microsoft Huihui'),
            h('span', { class: 'ws-voice-lang' }, 'zh-CN'),
            h('span', { class: 'ws-voice-tag ws-voice-tag--local' }, '本地'),
            h('span', { class: 'ws-voice-tag ws-voice-tag--default' }, '默认'),
          ),
          h('div', { class: 'ws-voice-item' },
            h('span', { class: 'ws-voice-name' }, 'Google 普通话'),
            h('span', { class: 'ws-voice-lang' }, 'zh-CN'),
            h('span', { class: 'ws-voice-tag ws-voice-tag--cloud' }, '云端'),
          ),
          h('div', { class: 'ws-voice-item' },
            h('span', { class: 'ws-voice-name' }, 'Microsoft David'),
            h('span', { class: 'ws-voice-lang' }, 'en-US'),
            h('span', { class: 'ws-voice-tag ws-voice-tag--local' }, '本地'),
          ),
          h('div', { class: 'ws-voice-item' },
            h('span', { class: 'ws-voice-name' }, 'Samantha'),
            h('span', { class: 'ws-voice-lang' }, 'en-US'),
            h('span', { class: 'ws-voice-tag ws-voice-tag--local' }, '本地'),
          ),
          h('div', { class: 'ws-voice-item' },
            h('span', { class: 'ws-voice-name' }, 'Kyoko'),
            h('span', { class: 'ws-voice-lang' }, 'ja-JP'),
            h('span', { class: 'ws-voice-tag ws-voice-tag--local' }, '本地'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const synth = window.speechSynthesis;
let voices = synth.getVoices();

function loadVoices() {
  voices = synth.getVoices();
  // 按 lang 筛选中文语音
  const zh = voices.filter((v: any) => v.lang === 'zh-CN');
  const local = voices.filter((v: any) => v.localService); // 本地无延迟
  console.log(zh, local);
}

if (voices.length === 0) {
  synth.addEventListener('voiceschanged', loadVoices, { once: true });
} else {
  loadVoices();
}

// 指定语音朗读
const u = new SpeechSynthesisUtterance('你好');
u.voice = voices.find((v: any) => v.lang === 'zh-CN');
u.lang = 'zh-CN';
synth.speak(u);

// 持久化偏好
localStorage.setItem('preferred-voice', u.voice.voiceURI);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.voiceInfo || '（点击按钮查看 SpeechSynthesisVoice 语音选择完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：SpeechSynthesis 实战：队列与节奏控制 =====================

  _runSynthControlDemo() {
    const f = this._flags();
    this._injectStyle('ws-synth-control-demo', `
      .ws-control-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (f.speechSynthesis && f.speechSynthesisUtterance) {
      try {
        // 演示队列：分句朗读
        const sentences = ['第一句：队列演示开始。', '第二句：顺序播放。', '第三句：队列结束。'];
        sentences.forEach((text: any) => {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'zh-CN';
          u.rate = 1;
          window.speechSynthesis.speak(u);
        });
        this._addLog('info', `TTS 队列已加入 ${sentences.length} 个 utterance，顺序播放`);
      } catch (err: any) {
        this._addLog('warn', `TTS 队列演示失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'speechSynthesis 不可用，跳过真实队列朗读（jsdom 无 TTS）');
    }
    const info = [
      '===== SpeechSynthesis 实战：队列与节奏控制 =====',
      '',
      '【speak() 自动队列】',
      '  // 多个 utterance 顺序播放（无需手动衔接）',
      '  const u1 = new SpeechSynthesisUtterance("第一句");',
      '  const u2 = new SpeechSynthesisUtterance("第二句");',
      '  synth.speak(u1);  // 立即开始',
      '  synth.speak(u2);  // 排队，u1 结束后自动播放',
      '  // synth.pending === true（队列中有待播）',
      '',
      '【cancel() 清空整个队列】',
      '  synth.cancel();  // 停止当前 + 清空队列，所有 utterance 触发 onend',
      '  // 注意：cancel 会中断所有 utterance，包括未开始的',
      '',
      '【pause() / resume() 暂停恢复】',
      '  synth.pause();   // 暂停当前朗读（synth.paused === true）',
      '  synth.resume();  // 恢复（synth.paused === false）',
      '  // Chrome 早期版本 resume 有 bug，可能无法恢复，需 setTimeout',
      '',
      '【rate 语速控制（0.1-10，默认 1）】',
      '  u.rate = 0.5;   // 慢速（适合跟读）',
      '  u.rate = 1;     // 正常',
      '  u.rate = 2;     // 快速（适合速读）',
      '  u.rate = 10;    // 极速（几乎听不清）',
      '  // rate 过高会丢失音节，建议 0.5-2',
      '',
      '【pitch 音调控制（0-2，默认 1）】',
      '  u.pitch = 0;    // 最低（沉闷）',
      '  u.pitch = 1;    // 正常',
      '  u.pitch = 2;    // 最高（尖锐）',
      '  // 适合角色区分（男声低 pitch，女声高 pitch）',
      '',
      '【volume 音量控制（0-1，默认 1）】',
      '  u.volume = 0;   // 静音',
      '  u.volume = 0.5; // 半音量',
      '  u.volume = 1;   // 最大',
      '',
      '【长文本分句队列（避免单 utterance 过长截断）】',
      '  // Chrome 单 utterance 超过 ~15 秒可能被截断',
      '  function speakLong(text) {',
      '    synth.cancel();  // 先清空',
      '    // 按句号/问号/感叹号分句',
      '    const sentences = text.match(/[^。！？.!?]+[。！？.!?]?/g) || [text];',
      '    sentences.forEach((s: any) => {',
      '      const u = new SpeechSynthesisUtterance(s.trim());',
      '      u.lang = "zh-CN";',
      '      u.rate = 1;',
      '      synth.speak(u);  // 顺序入队',
      '    });',
      '  }',
      '',
      '【mark 标记与 SSML（部分浏览器支持）】',
      '  // SSML（Synthesis Markup Language），Chrome 部分支持',
      '  const ssml = `',
      '    <speak>',
      '      你好<break time="1s"/>世界',
      '      <emphasis level="strong">重要</emphasis>',
      '      <mark name="here"/>标记点',
      '    </speak>',
      '  `;',
      '  const u = new SpeechSynthesisUtterance(ssml);',
      '  u.onmark = (e: any) => console.log("标记", e.markName);  // "here"',
      '  // <break time="1s"/> 插入停顿',
      '  // <emphasis> 强调',
      '  // <mark name="..."/> 触发 onmark 事件',
      '  // 注意：SSML 支持有限，Safari 不支持，Chrome 部分支持',
      '',
      '【boundary 事件实现卡拉OK式高亮】',
      '  const u = new SpeechSynthesisUtterance("你好 世界 你 好");',
      '  u.lang = "zh-CN";',
      '  let lastIdx = 0;',
      '  u.onboundary = (e: any) => {',
      '    if (e.name === "word") {',
      '      // e.charIndex 是当前词在 text 中的起始位置',
      '      highlightRange(lastIdx, e.charIndex);',
      '      lastIdx = e.charIndex;',
      '    }',
      '  };',
      '  u.onend = () => highlightRange(lastIdx, u.text.length);',
      '  synth.speak(u);',
      '',
      '  // 高亮函数：将 [start, end) 区间的词高亮',
      '  function highlightRange(start, end) {',
      '    document.querySelectorAll(".word").forEach((el: any, i: number) => {',
      '      el.classList.toggle("active", i >= start && i < end);',
      '    });',
      '  }',
      '',
      '【实战 1：朗读器（长文本分句 + 进度）】',
      '  function reader(text, onProgress) {',
      '    const sentences = splitSentences(text);',
      '    let idx = 0;',
      '    function next() {',
      '      if (idx >= sentences.length) return;',
      '      const u = new SpeechSynthesisUtterance(sentences[idx]);',
      '      u.lang = "zh-CN";',
      '      u.onend = () => { idx++; onProgress(idx / sentences.length); next(); };',
      '      synth.speak(u);',
      '    }',
      '    next();',
      '  }',
      '',
      '【实战 2：字幕同步（boundary 高亮当前词）】',
      '  // 配合 onboundary 实时高亮朗读到的词',
      '  // 适合：歌词同步、有声书、教学朗读',
      '',
      '【实战 3：多角色对话（不同 voice + pitch）】',
      '  const voices = synth.getVoices();',
      '  const male = voices.find((v: any) => v.name.includes("David"));',
      '  const female = voices.find((v: any) => v.name.includes("Huihui"));',
      '  function dialog(role, text) {',
      '    const u = new SpeechSynthesisUtterance(text);',
      '    u.voice = role === "M" ? male : female;',
      '    u.pitch = role === "M" ? 0.8 : 1.3;  // 男低女高',
      '    synth.speak(u);',
      '  }',
      '  dialog("M", "你好");',
      '  dialog("F", "你好呀");',
      '',
      '【浏览器支持】',
      `  speechSynthesis: ${f.speechSynthesis ? '✓' : '✗'}`,
      '  SSML: 部分支持（Chrome 部分，Safari 不支持）',
      '  onboundary: Chrome/Safari 支持，Firefox 不稳定',
      '',
      '【常见陷阱】',
      '  1. 长文本单 utterance 被截断 → 分句队列',
      '  2. cancel() 中断所有，不能只取消队列中某个',
      '  3. pause/resume 在 Chrome 早期版本有 bug',
      '  4. SSML 各浏览器支持不一，生产环境需降级',
      '  5. boundary 事件在某些 voice 不触发（云端 voice 尤其）',
      '  6. 队列过长可能被浏览器限制（建议 < 50 个）',
    ].join('\n');
    this.setState({ synthControlInfo: info });
    this._addLog('speech', `SpeechSynthesis 队列与节奏控制演示完成；supports=${f.speechSynthesis}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. SpeechSynthesis 实战 —— 队列与节奏控制（rate/pitch/volume/boundary）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['队列/节奏', f.speechSynthesis]]),
        h(Tag, { color: 'primary' }, 'TTS 实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'speak() 自动队列（多 utterance 顺序播放），cancel() 清空整个队列，pause()/resume() 暂停恢复。rate（0.1-10 默认 1）控制语速，pitch（0-2 默认 1）控制音调，volume（0-1 默认 1）音量。长文本分句队列避免单 utterance 过长截断。mark 标记与 SSML（部分浏览器支持 break/emphasis）。boundary 事件实现卡拉OK式词高亮。实战：朗读器、字幕同步、多角色对话（不同 voice+pitch）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('朗读队列演示', { type: 'primary', size: 'sm', onClick: () => this._runSynthControlDemo() }),
        ),
        h('div', { class: 'ws-karaoke' },
          h('span', { class: 'ws-word ws-word--active' }, '你好'),
          h('span', { class: 'ws-word' }, '，'),
          h('span', { class: 'ws-word' }, '世界'),
          h('span', { class: 'ws-word' }, '！'),
          h('span', { class: 'ws-word' }, '这是'),
          h('span', { class: 'ws-word' }, '卡拉OK'),
          h('span', { class: 'ws-word' }, '高亮'),
          h('span', { class: 'ws-word' }, '演示'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const synth = window.speechSynthesis;

// 长文本分句队列（避免截断）
function speakLong(text: any) {
  synth.cancel();
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]?/g) || [text];
  sentences.forEach((s: any) => {
    const u = new SpeechSynthesisUtterance(s.trim());
    u.lang = 'zh-CN';
    u.rate = 1;     // 语速 0.1-10
    u.pitch = 1;    // 音调 0-2
    u.volume = 1;   // 音量 0-1
    // 卡拉OK 词边界高亮
    u.onboundary = (e: any) => {
      if (e.name === 'word') highlight(e.charIndex);
    };
    synth.speak(u);  // 顺序入队
  });
}

// SSML 标记（部分浏览器支持）
const u = new SpeechSynthesisUtterance(
  '<speak>你好<break time="1s"/>世界</speak>'
);
u.onmark = (e: any) => console.log('mark', e.markName);
synth.speak(u);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.synthControlInfo || '（点击按钮查看队列与节奏控制完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：SpeechRecognition 识别基础 =====================

  _runRecogBasicDemo() {
    const f = this._flags();
    this._injectStyle('ws-recog-basic-demo', `
      .ws-recog-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (f.speechRecognition) {
      this._addLog('warn', '检测到 SpeechRecognition 支持，但 jsdom 无真实麦克风，跳过真实识别（真实浏览器需用户手势触发）');
    } else {
      this._addLog('warn', 'SpeechRecognition 不可用，跳过真实识别（jsdom 无 ASR，Firefox 默认禁用）');
    }
    const info = [
      '===== SpeechRecognition 识别基础 =====',
      '',
      '【创建识别器（兼容 webkit 前缀）】',
      '  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;',
      '  const recognition = new SR();',
      '  // 注意：Safari/旧 Chrome 仅 webkitSpeechRecognition',
      '',
      '【recognition 属性】',
      '  recognition.lang = "zh-CN";           // 识别语言（BCP 47）',
      '  recognition.continuous = false;       // false=单次（默认），true=持续',
      '  recognition.interimResults = false;   // false=仅最终结果，true=含中间结果',
      '  recognition.maxAlternatives = 1;      // 备选结果数（1-10）',
      '  recognition.grammars = grammarList;   // SpeechGrammarList 语法约束（见 Card 7）',
      '',
      '【recognition 方法】',
      '  recognition.start();  // 开始识别（需用户手势激活）',
      '  recognition.stop();   // 停止识别（优雅停止，返回最后结果）',
      '  recognition.abort();  // 中止识别（立即停止，不返回结果）',
      '',
      '【recognition 事件（8 个）】',
      '  recognition.onstart        = (e: any) => {};  // 识别开始',
      '  recognition.onend          = (e: any) => {};  // 识别结束（正常/停止/中止）',
      '  recognition.onerror        = (e: any) => {};  // 出错，e.error 含错误类型',
      '  (recognition as any).onspeechstart  = (e: any) => {};  // 检测到语音开始',
      '  (recognition as any).onspeechend    = (e: any) => {};  // 检测到语音结束',
      '  (recognition as any).onsoundstart   = (e: any) => {};  // 检测到声音（含非语音）',
      '  (recognition as any).onsoundend     = (e: any) => {};  // 声音结束',
      '  recognition.onresult       = (e: any) => {};  // 识别结果（核心事件）',
      '',
      '【onerror 错误类型（e.error）】',
      '  no-speech            没有检测到语音（超时）',
      '  aborted              被 abort() 中止',
      '  audio-capture        音频采集失败（无麦克风/硬件问题）',
      '  network              网络错误（Chrome 云端识别需联网）',
      '  not-allowed          麦克风权限被拒绝',
      '  service-not-allowed  识别服务不可用（如非 HTTPS）',
      '  bad-grammar          语法错误（GrammarList 格式问题）',
      '  language-not-supported  语言不支持',
      '',
      '【continuous 单次 vs 持续识别】',
      '  // 单次模式（默认）：用户说一句后自动 stop',
      '  recognition.continuous = false;',
      '  recognition.start();',
      '  // 说完一句话 → onresult → onend',
      '',
      '  // 持续模式：持续识别直到 stop()/abort()',
      '  recognition.continuous = true;',
      '  recognition.start();',
      '  // 持续输出结果，直到手动 stop()',
      '  // 注意：Chrome 持续模式可能自动 stop，需 onend 重启',
      '',
      '【interimResults 中间结果】',
      '  recognition.interimResults = true;',
      '  // 实时输出中间识别结果（isFinal=false）',
      '  // 适合实时字幕、语音输入框',
      '  recognition.interimResults = false;',
      '  // 仅返回最终结果（isFinal=true），延迟较高',
      '',
      '【maxAlternatives 备选结果数】',
      '  recognition.maxAlternatives = 3;',
      '  // event.results[0] 返回最多 3 个备选',
      '  // result[0] 最可能，result[1] 次之...',
      '',
      '【最简识别示例】',
      '  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;',
      '  const rec = new SR();',
      '  rec.lang = "zh-CN";',
      '  rec.continuous = false;',
      '  rec.interimResults = false;',
      '  rec.onresult = (e: any) => {',
      '    const transcript = e.results[0][0].transcript;',
      '    console.log("识别结果:", transcript);',
      '  };',
      '  rec.onerror = (e: any) => console.error("错误:", e.error);',
      '  rec.start();  // 需在用户手势中调用',
      '',
      '【安全上下文与权限】',
      '  - 必须 HTTPS 或 localhost',
      '  - 需麦克风权限（首次 start() 弹窗）',
      '  - 必须用户激活（点击按钮触发，不能自动 start）',
      '  - 权限被拒 → onerror: not-allowed',
      '',
      '【浏览器支持】',
      `  SpeechRecognition: ${f.speechRecognition ? '✓' : '✗'}`,
      '  Chrome/Edge: ✓（webkit 前缀，云端识别）',
      '  Safari: ✓ iOS 14.5+（webkit 前缀）',
      '  Firefox: ✗ 默认禁用（需 about:config 开启）',
      '',
      '【常见陷阱】',
      '  1. start() 必须在用户手势中调用（不能页面加载自动启动）',
      '  2. Chrome 持续模式（continuous=true）可能自动 stop，需 onend 重启',
      '  3. Chrome 识别走 Google 云服务，离线不可用',
      '  4. 重复 start() 会抛 InvalidStateError（需先等 onend）',
      '  5. 移动端屏幕锁定时识别中断',
      '  6. 长时间无语音（no-speech）会自动结束',
    ].join('\n');
    this.setState({ recogBasicInfo: info });
    this._addLog('speech', `SpeechRecognition 识别基础演示完成；supports=${f.speechRecognition}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. SpeechRecognition 识别基础 —— ASR 核心 API',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['SpeechRecognition', f.speechRecognition]]),
        h(Tag, { color: 'primary' }, 'ASR 基础'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new (SpeechRecognition || webkitSpeechRecognition)() 创建识别器。属性 lang（zh-CN/en-US）、continuous（单次 vs 持续）、interimResults（中间结果）、maxAlternatives（备选数）。方法 start()/stop()/abort()。事件 onstart/onend/onerror/onspeechstart/onspeechend/onsoundstart/onsoundend/onresult。onerror 错误类型：no-speech/aborted/audio-capture/network/not-allowed/service-not-allowed/bad-grammar。必须 HTTPS/localhost + 麦克风权限 + 用户激活。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('启动识别', { type: 'primary', size: 'sm', onClick: () => this._runRecogBasicDemo() }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          h('div', { class: 'ws-mic' }, '🎤'),
          h('span', { class: 'ws-status ws-status--no' }, '未启动'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const rec = new SR();
rec.lang = 'zh-CN';
rec.continuous = false;       // 单次识别
rec.interimResults = false;   // 仅最终结果
rec.maxAlternatives = 1;      // 备选数

rec.onstart = () => console.log('识别开始');
rec.onend = () => console.log('识别结束');
rec.onerror = (e: any) => console.error('错误:', e.error);
(rec as any).onspeechstart = () => console.log('检测到语音');
rec.onresult = (e: any) => {
  const transcript = e.results[0][0].transcript;
  const confidence = e.results[0][0].confidence;
  console.log('结果:', transcript, '置信度:', confidence);
};

// 必须在用户手势中调用（如按钮点击）
button.addEventListener('click', () => rec.start());
// rec.stop();  // 优雅停止
// rec.abort(); // 立即中止`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.recogBasicInfo || '（点击按钮查看 SpeechRecognition 识别基础完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：SpeechRecognitionEvent 与 SpeechRecognitionResult =====================

  _runResultDemo() {
    const f = this._flags();
    this._injectStyle('ws-result-demo', `
      .ws-result-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (f.speechRecognition) {
      this._addLog('warn', '检测到 SpeechRecognition 支持，jsdom 无真实麦克风跳过实时识别（真实浏览器需用户手势）');
    } else {
      this._addLog('warn', 'SpeechRecognition 不可用，跳过实时字幕演示（jsdom 无 ASR）');
    }
    const info = [
      '===== SpeechRecognitionEvent 与 SpeechRecognitionResult =====',
      '',
      '【事件结构层次】',
      '  SpeechRecognitionEvent',
      '    └─ event.results  (SpeechRecognitionResultList，类数组)',
      '         └─ results[i]  (SpeechRecognitionResult，含 isFinal)',
      '              └─ result[0]  (SpeechRecognitionAlternative)',
      '                   ├─ .transcript  识别文本',
      '                   └─ .confidence  置信度 0-1',
      '',
      '【event.results：SpeechRecognitionResultList】',
      '  rec.onresult = (e: any) => {',
      '    console.log(e.results.length);   // 结果总数',
      '    console.log(e.resultIndex);      // 本次新增结果起始索引',
      '    for (let i = e.resultIndex; i < e.results.length; i++) {',
      '      const result = e.results[i];   // SpeechRecognitionResult',
      '      console.log(result.isFinal);   // true=最终，false=中间',
      '      console.log(result[0].transcript);  // 最可能结果',
      '      console.log(result[0].confidence);  // 置信度 0-1',
      '    }',
      '  };',
      '',
      '【results[i]：SpeechRecognitionResult】',
      '  const result = e.results[i];',
      '  result.isFinal;   // true=最终结果（稳定），false=中间结果（可能变化）',
      '  result.length;    // 备选结果数（受 maxAlternatives 控制）',
      '  result[0];        // 第一个备选（最可能）',
      '  result[1];        // 第二个备选（次之）',
      '',
      '【result[0]：SpeechRecognitionAlternative】',
      '  const alt = result[0];',
      '  alt.transcript;   // 识别出的文本',
      '  alt.confidence;   // 置信度 0-1（1 最确定）',
      '  // confidence < 0.5 通常不可靠，可提示用户重说',
      '',
      '【maxAlternatives 控制备选数】',
      '  rec.maxAlternatives = 3;',
      '  rec.onresult = (e: any) => {',
      '    const result = e.results[0];',
      '    for (let i = 0; i < result.length; i++) {',
      '      console.log(i, result[i].transcript, result[i].confidence);',
      '      // 0 "打开灯" 0.95  （最可能）',
      '      // 1 "打开等" 0.03  （次之）',
      '      // 2 "大开门" 0.01  （最不可能）',
      '    }',
      '  };',
      '',
      '【event.resultIndex：当前结果起始索引】',
      '  // continuous=true 时，results 累积所有结果',
      '  // resultIndex 指向本次事件新增的起始索引',
      '  rec.onresult = (e: any) => {',
      '    let final = "";',
      '    let interim = "";',
      '    for (let i = 0; i < e.results.length; i++) {',
      '      if (e.results[i].isFinal) {',
      '        final += e.results[i][0].transcript;',
      '      } else {',
      '        interim += e.results[i][0].transcript;',
      '      }',
      '    }',
      '    console.log("最终:", final, "中间:", interim);',
      '  };',
      '',
      '【continuous + interimResults 实现实时字幕】',
      '  rec.continuous = true;',
      '  rec.interimResults = true;',
      '  let finalText = "";',
      '  rec.onresult = (e: any) => {',
      '    let interim = "";',
      '    for (let i = e.resultIndex; i < e.results.length; i++) {',
      '      if (e.results[i].isFinal) {',
      '        finalText += e.results[i][0].transcript;',
      '      } else {',
      '        interim += e.results[i][0].transcript;',
      '      }',
      '    }',
      '    // 实时更新字幕：finalText + interim',
      '    captionEl.innerHTML = `<span class="final">${finalText}</span><span class="interim">${interim}</span>`;',
      '  };',
      '',
      '【transcript 后处理】',
      '  // 1. 首字母大写',
      '  const text = transcript.charAt(0).toUpperCase() + transcript.slice(1);',
      '',
      '  // 2. 自动加标点（部分浏览器已自带）',
      '  // Chrome 部分语言自动加句号，中文通常无',
      '',
      '  // 3. 敏感词过滤',
      '  const sensitive = ["暴力", "色情"];',
      '  let filtered = transcript;',
      '  sensitive.forEach((w: any) => filtered = filtered.replace(new RegExp(w, "g"), "***"))',
      '',
      '  // 4. 去除首尾空格',
      '  transcript.trim();',
      '',
      '【实战 1：语音指令】',
      '  rec.onresult = (e: any) => {',
      '    const cmd = e.results[e.results.length - 1][0].transcript.trim();',
      '    if (cmd.includes("打开灯")) turnOnLight();',
      '    else if (cmd.includes("关闭灯")) turnOffLight();',
      '    else if (cmd.includes("搜索")) search(cmd.replace("搜索", ""));',
      '  };',
      '',
      '【实战 2：语音搜索框】',
      '  rec.onresult = (e: any) => {',
      '    const query = e.results[0][0].transcript;',
      '    searchInput.value = query;',
      '    if (e.results[0].isFinal) searchForm.submit();',
      '  };',
      '',
      '【实战 3：实时字幕】',
      '  // continuous + interimResults 配合，实时显示',
      '  // finalText 累积 + interim 实时更新',
      '',
      '【浏览器支持】',
      `  SpeechRecognition: ${f.speechRecognition ? '✓' : '✗'}`,
      '  isFinal/interimResults: Chrome/Edge/Safari 支持',
      '  confidence: Chrome 支持，Safari 可能返回 0',
      '',
      '【常见陷阱】',
      '  1. confidence 在某些浏览器/voice 返回 0，不能完全依赖',
      '  2. interimResults 中间结果会不断变化，UI 需防抖',
      '  3. continuous 模式 results 累积，内存需定期清理',
      '  4. 中文识别通常无标点，需自行处理',
      '  5. maxAlternatives 过大影响性能，建议 1-3',
      '  6. resultIndex 之前的 results 不会变化，可直接累积',
    ].join('\n');
    this.setState({ resultInfo: info });
    this._addLog('speech', `SpeechRecognitionEvent 与 Result 演示完成；supports=${f.speechRecognition}`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. SpeechRecognitionEvent 与 SpeechRecognitionResult —— 识别结果结构',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['Result API', f.speechRecognition]]),
        h(Tag, { color: 'primary' }, '结果结构'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'event.results 是 SpeechRecognitionResultList（类数组），results[i] 是 SpeechRecognitionResult（含 isFinal），result[0] 是 SpeechRecognitionAlternative（.transcript 文本 + .confidence 置信度 0-1）。maxAlternatives 控制备选数 result[0..n]。event.resultIndex 当前结果起始索引。continuous + interimResults 配合实现实时字幕。transcript 处理：首字母大写、标点、敏感词过滤。实战：语音指令、语音搜索、实时字幕。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('实时字幕演示', { type: 'primary', size: 'sm', onClick: () => this._runResultDemo() }),
        ),
        h('div', { class: 'ws-caption' },
          h('span', { class: 'ws-final' }, '你好世界'),
          h('span', { class: 'ws-interim' }, ' 这是中间结果...'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `rec.continuous = true;
rec.interimResults = true;
rec.maxAlternatives = 3;
let finalText = '';

rec.onresult = (e: any) => {
  let interim = '';
  // 从 resultIndex 开始遍历新增结果
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const result = e.results[i];        // SpeechRecognitionResult
    if (result.isFinal) {
      finalText += result[0].transcript; // 最终结果累积
    } else {
      interim += result[0].transcript;   // 中间结果临时
    }
    // 备选结果
    for (let j = 0; j < result.length; j++) {
      console.log(j, result[j].transcript, result[j].confidence);
    }
  }
  // 实时字幕：final + interim
  caption.innerHTML =
    '<span class="final">' + finalText + '</span>' +
    '<span class="interim">' + interim + '</span>';
};`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.resultInfo || '（点击按钮查看 SpeechRecognitionEvent 与 Result 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：SpeechGrammarList 与语法约束 =====================

  _runGrammarDemo() {
    const f = this._flags();
    this._injectStyle('ws-grammar-demo', `
      .ws-grammar-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (f.speechGrammarList) {
      this._addLog('info', '检测到 SpeechGrammarList 支持（Chrome 部分支持），真实语法约束需配合 SpeechRecognition');
    } else {
      this._addLog('warn', 'SpeechGrammarList 不可用（Chrome 部分支持，Safari/Firefox 不支持）');
    }
    const info = [
      '===== SpeechGrammarList 与语法约束 =====',
      '',
      '【创建语法列表】',
      '  const grammarList = new SpeechGrammarList();',
      '',
      '【addFromString(grammarString, weight) 添加 JSGF 语法】',
      '  const jsgf = `',
      '    #JSGF V1.0;',
      '    grammar commands;',
      '    public <command> = (打开 | 关闭 | 切换) (灯 | 窗帘 | 音乐);',
      '  `;',
      '  grammarList.addFromString(jsgf, 1.0);  // weight 权重 0-1',
      '',
      '【addFromURI(uri, weight) 从 URL 加载】',
      '  grammarList.addFromURI("./grammars/commands.jsgf", 1.0);',
      '  // 异步加载，需等加载完成后再 start()',
      '',
      '【JSGF（JSpeech Grammar Format）语法格式】',
      '  #JSGF V1.0;                    // 版本声明',
      '  grammar commands;              // 语法名',
      '  public <command> =             // 公共规则',
      '    (打开 | 关闭 | 切换)         // 选择：或',
      '    (灯 | 窗帘 | 音乐);          // 选择：或',
      '',
      '  // 规则引用',
      '  <action> = 打开 | 关闭 | 切换;',
      '  <target> = 灯 | 窗帘 | 音乐;',
      '  public <command> = <action> <target>;',
      '',
      '  // 可选与重复',
      '  <optional> = [请];             // [] 表示可选',
      '  <repeat> = <word>+;            // + 表示一次或多次',
      '  <repeat0> = <word>*;           // * 表示零次或多次',
      '',
      '【recognition.grammars = grammarList 设置】',
      '  const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();',
      '  rec.grammars = grammarList;  // 应用语法约束',
      '  rec.lang = "zh-CN";',
      '  rec.start();',
      '',
      '【weight 权重 0-1】',
      '  // 多个语法时，weight 决定相对权重',
      '  grammarList.addFromString(grammarA, 1.0);  // 高权重',
      '  grammarList.addFromString(grammarB, 0.5);  // 低权重',
      '  // 权重影响识别引擎对语法匹配的偏好',
      '',
      '【语法约束提升识别准确率】',
      '  // 无语法：自由识别，准确率低，适合听写',
      '  // 有语法：限定词汇集，准确率高，适合指令',
      '  // 例：限定"打开/关闭/切换 + 灯/窗帘/音乐"',
      '  //   识别"打开灯"准确率 > 自由识别',
      '',
      '【应用场景 1：语音指令系统（限定词汇集）】',
      '  const cmdGrammar = `',
      '    #JSGF V1.0;',
      '    grammar commands;',
      '    public <command> =',
      '      (打开 | 关闭) (灯 | 空调 | 电视)',
      '      | 切换 (频道 | 模式)',
      '      | 调 (高 | 低) 音量;',
      '  `;',
      '  const gl = new SpeechGrammarList();',
      '  gl.addFromString(cmdGrammar, 1.0);',
      '  rec.grammars = gl;',
      '  rec.onresult = (e: any) => {',
      '    const cmd = e.results[0][0].transcript;',
      '    executeCommand(cmd);  // 准确率高',
      '  };',
      '',
      '【应用场景 2：IVR 替代（语音菜单）】',
      '  // 传统 IVR 按键 → 语音菜单',
      '  const menuGrammar = `',
      '    #JSGF V1.0;',
      '    grammar menu;',
      '    public <choice> = (销售 | 技术 | 售后 | 人工服务);',
      '  `;',
      '  // 用户说"销售"直接转接，无需按键',
      '',
      '【应用场景 3：表单填充（限定字段值）】',
      '  // 性别、省份等枚举字段',
      '  const genderGrammar = `',
      '    #JSGF V1.0;',
      '    grammar gender;',
      '    public <gender> = 男 | 女;',
      '  `;',
      '',
      '【浏览器支持（有限）】',
      `  SpeechGrammarList: ${f.speechGrammarList ? '✓' : '✗'}`,
      '  Chrome: ✓ 部分支持（语法作为提示，非强制约束）',
      '  Edge: ✓ 同 Chrome',
      '  Safari: ✗ 不支持',
      '  Firefox: ✗ 不支持',
      '',
      '【重要说明：Chrome 的语法是「提示」非「约束」】',
      '  // Chrome 中 grammars 仅作为识别提示，提升匹配概率',
      '  // 不强制只识别语法内的词，仍可能返回语法外结果',
      '  // 需在 onresult 中自行校验',
      '  rec.onresult = (e: any) => {',
      '    const cmd = e.results[0][0].transcript;',
      '    if (!isValidCommand(cmd)) {',
      '      console.warn("非合法指令:", cmd);',
      '      return;',
      '    }',
      '    executeCommand(cmd);',
      '  };',
      '',
      '【常见陷阱】',
      '  1. Chrome 语法非强制约束，仍需 onresult 校验',
      '  2. Safari/Firefox 不支持 SpeechGrammarList，需降级',
      '  3. JSGF 语法格式严格，错误会触发 bad-grammar error',
      '  4. 中文 JSGF 支持有限，英文更稳定',
      '  5. addFromURI 跨域需 CORS',
      '  6. weight 设为 0 等于不使用该语法',
    ].join('\n');
    this.setState({ grammarInfo: info });
    this._addLog('speech', `SpeechGrammarList 语法约束演示完成；supports=${f.speechGrammarList}`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. SpeechGrammarList 与语法约束 —— JSGF 限定词汇集',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['GrammarList', f.speechGrammarList]]),
        h(Tag, { color: 'primary' }, '语法约束'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new SpeechGrammarList() 创建语法列表，addFromString(grammarString, weight) 添加 JSGF 语法，addFromURI(uri, weight) 从 URL 加载。JSGF（JSpeech Grammar Format）格式：#JSGF V1.0; grammar commands; public <command> = (打开 | 关闭 | 切换) (灯 | 窗帘 | 音乐);。recognition.grammars = grammarList 设置，weight 权重 0-1。语法约束提升识别准确率，适合语音指令系统、IVR 替代。浏览器支持有限（Chrome 部分支持，Safari/Firefox 不支持）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('语法约束演示', { type: 'primary', size: 'sm', onClick: () => this._runGrammarDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `const grammar = ` + '`#JSGF V1.0;\ngrammar commands;\npublic <command> = (打开 | 关闭 | 切换) (灯 | 窗帘 | 音乐);`' + `;

const gl = new SpeechGrammarList();
gl.addFromString(grammar, 1.0);  // weight 0-1

const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
rec.grammars = gl;     // 应用语法约束
rec.lang = 'zh-CN';
rec.maxAlternatives = 1;

rec.onresult = (e: any) => {
  const cmd = e.results[0][0].transcript;
  // Chrome 语法是提示非约束，仍需校验
  if (!/^(打开|关闭|切换)(灯|窗帘|音乐)$/.test(cmd)) {
    console.warn('非合法指令:', cmd);
    return;
  }
  executeCommand(cmd);
};
rec.start();`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.grammarInfo || '（点击按钮查看 SpeechGrammarList 语法约束完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：实战模式与陷阱 =====================

  _runPatternDemo() {
    const f = this._flags();
    this._injectStyle('ws-pattern-demo', `
      .ws-pattern-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== 实战模式与陷阱清单 =====',
      '',
      '【模式 1：语音助手（TTS + ASR 闭环）】',
      '  // 听 → 识别 → 处理 → 回应朗读',
      '  const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();',
      '  rec.lang = "zh-CN";',
      '  rec.continuous = false;',
      '  rec.interimResults = false;',
      '',
      '  rec.onresult = (e: any) => {',
      '    const heard = e.results[0][0].transcript;',
      '    const reply = processCommand(heard);  // 业务逻辑',
      '    speakReply(reply);  // TTS 朗读回应',
      '  };',
      '',
      '  function speakReply(text) {',
      '    const u = new SpeechSynthesisUtterance(text);',
      '    u.lang = "zh-CN";',
      '    window.speechSynthesis.speak(u);',
      '  }',
      '',
      '  // 启动：按钮点击 → rec.start()',
      '  // 流程：用户说 → ASR 识别 → 处理 → TTS 回应 → 继续监听',
      '',
      '【模式 2：语音搜索框】',
      '  // 麦克风按钮 → 识别 → 填入搜索框 → 自动搜索',
      '  micBtn.addEventListener("click", () => {',
      '    rec.lang = "zh-CN";',
      '    rec.onresult = (e: any) => {',
      '      searchInput.value = e.results[0][0].transcript;',
      '      if (e.results[0].isFinal) searchForm.submit();',
      '    };',
      '    rec.start();',
      '  });',
      '',
      '【模式 3：无障碍朗读（屏幕阅读器增强）】',
      '  // 点击元素朗读其文本（适合视障用户）',
      '  document.querySelectorAll("[aria-label]").forEach((el: any) => {',
      '    el.addEventListener("focus", () => {',
      '      const u = new SpeechSynthesisUtterance(el.getAttribute("aria-label"));',
      '      u.lang = "zh-CN";',
      '      window.speechSynthesis.speak(u);',
      '    });',
      '  });',
      '',
      '【模式 4：多语言切换】',
      '  function speak(text, lang) {',
      '    const voices = window.speechSynthesis.getVoices();',
      '    const voice = voices.find((v: any) => v.lang === lang);',
      '    const u = new SpeechSynthesisUtterance(text);',
      '    u.voice = voice;',
      '    u.lang = lang;',
      '    window.speechSynthesis.speak(u);',
      '  }',
      '  speak("你好", "zh-CN");',
      '  speak("Hello", "en-US");',
      '',
      '【模式 5：离线识别（浏览器原生不支持，需 WASM + 模型）】',
      '  // Web Speech API 的 ASR 在 Chrome 走云端，离线不可用',
      '  // 离线方案：WASM + 本地模型',
      '  //   - Vosk（vosk-browser）：离线 Kaldi 模型',
      '  //   - whisper.cpp（WASM 编译）：OpenAI Whisper 本地版',
      '  //   - Sherlock/Voice Assist 等',
      '',
      '  // Vosk 示例：',
      '  // const model = await Vosk.createModel("model.json");',
      '  // const rec = new model.KaldiRecognizer(sampleRate);',
      '  // rec.onresult = (e: any) => console.log(e.result.text);',
      '',
      '  // 优势：完全离线、隐私友好',
      '  // 劣势：模型大（几十 MB）、准确率低于云端',
      '',
      '【陷阱清单（9 大陷阱）】',
      '',
      '  陷阱 1：getVoices 异步需 voiceschanged',
      '    // 首次 getVoices() 返回空，必须监听 voiceschanged',
      '    synth.addEventListener("voiceschanged", loadVoices);',
      '',
      '  陷阱 2：ASR 需 HTTPS 或 localhost',
      '    // http:// 非 localhost 会被浏览器拒绝',
      '    // 检测：window.isSecureContext',
      '',
      '  陷阱 3：长文本 speak 可能被截断需分句',
      '    // Chrome 单 utterance > 15 秒可能截断',
      '    // 解决：按句号分句队列',
      '',
      '  陷阱 4：cancel 会中断所有 utterance',
      '    // synth.cancel() 清空整个队列，无法只取消某个',
      '    // 需自行管理 utterance 引用',
      '',
      '  陷阱 5：Safari 与 Chrome voice 名差异大',
      '    // Safari: Ting-Ting, Chrome: Google 普通话',
      '    // 不能硬编码 voice name，应用 voiceURI 持久化',
      '',
      '  陷阱 6：连续识别可能自动 stop 需 onend 重启',
      '    // Chrome continuous=true 可能因超时/no-speech 自动 stop',
      '    rec.onend = () => { if (shouldContinue) rec.start(); };',
      '    // 注意：重启可能触发权限弹窗（部分浏览器）',
      '',
      '  陷阱 7：移动端屏幕锁定时识别中断',
      '    // 屏幕熄屏 → ASR 停止，需 Wake Lock API 保持唤醒',
      '    // navigator.wakeLock.request("screen")',
      '',
      '  陷阱 8：权限请求需用户激活',
      '    // 不能页面加载自动 start()，必须在用户手势中',
      '    button.addEventListener("click", () => rec.start());',
      '',
      '  陷阱 9：Chrome 识别走 Google 云服务隐私问题',
      '    // Chrome ASR 音频发送到 Google 服务器',
      '    // 隐私敏感场景（医疗/金融）需离线方案或服务端 ASR',
      '',
      '【降级方案：Web Audio API + MediaRecorder 录音 + 服务端 ASR】',
      '  // 当 Web Speech API 不可用或不满足隐私需求时：',
      '  // 1. MediaRecorder 录制音频',
      '  async function recordAudio() {',
      '    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });',
      '    const recorder = new MediaRecorder(stream);',
      '    const chunks = [];',
      '    recorder.ondataavailable = (e: any) => chunks.push(e.data);',
      '    recorder.start();',
      '    return new Promise(resolve => {',
      '      recorder.onstop = () => resolve(new Blob(chunks));',
      '      setTimeout(() => recorder.stop(), 5000);',
      '    });',
      '  }',
      '',
      '  // 2. 上传服务端 ASR（百度/阿里/Azure/Whisper API）',
      '  const blob = await recordAudio();',
      '  const resp = await fetch("/api/asr", {',
      '    method: "POST",',
      '    body: blob,',
      '  });',
      '  const { text } = await resp.json();',
      '',
      '  // 3. 服务端 TTS 或浏览器 TTS 回应',
      '  // 优势：可控、隐私、跨浏览器',
      '  // 劣势：需服务端、延迟、成本',
      '',
      '【渐进增强策略】',
      '  // 1. 优先 Web Speech API（原生、低延迟）',
      '  // 2. 不支持时降级 MediaRecorder + 服务端 ASR',
      '  // 3. 完全不支持时提供文本输入兜底',
      '',
      '【浏览器支持总览】',
      `  speechSynthesis (TTS): ${f.speechSynthesis ? '✓' : '✗'}`,
      `  SpeechRecognition (ASR): ${f.speechRecognition ? '✓' : '✗'}`,
      `  SpeechGrammarList: ${f.speechGrammarList ? '✓' : '✗'}`,
      '',
      '【资源】',
      '  - W3C Web Speech API: https://wicg.github.io/speech-api/',
      '  - MDN SpeechSynthesis: https://developer.mozilla.org/docs/Web/API/SpeechSynthesis',
      '  - MDN SpeechRecognition: https://developer.mozilla.org/docs/Web/API/SpeechRecognition',
      '  - JSGF 规范: https://www.w3.org/TR/jsgf/',
      '  - Vosk 离线识别: https://alphacephei.com/vosk/',
      '  - whisper.cpp: https://github.com/ggerganov/whisper.cpp',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('speech', '实战模式与陷阱演示完成');
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战模式与陷阱（语音助手 / 语音搜索 / 无障碍 / 离线识别 / 降级方案）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.speechSynthesis || f.speechRecognition ? 'success' : 'error' }, `Web Speech ${f.speechSynthesis || f.speechRecognition ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '实战模式：语音助手（TTS+ASR 闭环）、语音搜索框、无障碍朗读、多语言切换、离线识别（WASM+Vosk/whisper.cpp）。9 大陷阱：getVoices 异步需 voiceschanged、ASR 需 HTTPS/localhost、长文本 speak 截断需分句、cancel 中断所有 utterance、Safari 与 Chrome voice 名差异、连续识别自动 stop 需 onend 重启、移动端屏幕锁定中断、权限需用户激活、Chrome 走云端隐私问题。降级方案：Web Audio API + MediaRecorder 录音 + 服务端 ASR。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 语音助手闭环：ASR 听 → 处理 → TTS 回应
const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
rec.lang = 'zh-CN';
rec.onresult = (e: any) => {
  const heard = e.results[0][0].transcript;
  const reply = processCommand(heard);
  // TTS 朗读回应
  const u = new SpeechSynthesisUtterance(reply);
  u.lang = 'zh-CN';
  window.speechSynthesis.speak(u);
};
rec.onend = () => { if (running) rec.start(); }; // 连续识别重启

// 降级方案：MediaRecorder 录音 + 服务端 ASR
async function recordAndRecognize() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e: any) => chunks.push(e.data);
  rec.start();
  setTimeout(() => rec.stop(), 5000);
  const blob = await new Promise(r => rec.onstop = () => r(new Blob(chunks)));
  const resp = await fetch('/api/asr', { method: 'POST', body: blob });
  return (await resp.json()).text;
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看实战模式与陷阱完整清单）')),
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
      h('h2', { class: 'section-title' }, 'Web Speech API 语音合成与识别深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'Web Speech API —— SpeechSynthesis（TTS 文本转语音）+ SpeechRecognition（ASR 语音转文本）两大子能力深度实验室',
        description: '演示 Web Speech API 两大子能力：SpeechSynthesis 合成（window.speechSynthesis 单例 + new SpeechSynthesisUtterance，speak/cancel/pause/resume + pending/speaking/paused 状态，utterance 的 text/lang/pitch/rate/volume/voice 属性与 onstart/onend/onerror/onpause/onresume/onmark/onboundary 8 个事件）、SpeechSynthesisVoice 语音选择深潜（name/lang/voiceURI/localService/default + getVoices + voiceschanged 异步加载 + 按 lang/localService 筛选 + Windows SAPI/macOS NSSpeechSynthesizer/Android Google TTS 跨平台差异 + 多语言切换与 voiceURI 持久化）、SpeechSynthesis 队列与节奏控制（speak 自动队列 + rate 0.1-10/pitch 0-2/volume 0-1 + 长文本分句 + mark/SSML break/emphasis + boundary 词边界卡拉OK高亮）、SpeechRecognition 识别基础（webkit 前缀 + lang/continuous/interimResults/maxAlternatives + start/stop/abort + 8 个事件 + onerror 错误类型 no-speech/aborted/audio-capture/network/not-allowed/service-not-allowed/bad-grammar）、SpeechRecognitionEvent 与 Result（results 类数组 + isFinal + transcript/confidence + resultIndex + continuous+interimResults 实时字幕）、SpeechGrammarList 与 JSGF 语法约束（addFromString/addFromURI + weight + 限定词汇集提升准确率）、实战模式与陷阱（语音助手闭环/语音搜索/无障碍朗读/多语言切换/离线 WASM Vosk/whisper.cpp + 9 大陷阱 + Web Audio+MediaRecorder+服务端 ASR 降级方案）。必须 HTTPS/localhost，ASR 需麦克风权限与用户激活。jsdom 无 speechSynthesis 所有检测为 false，真实浏览器 Chrome/Edge 可完整体验。',
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
