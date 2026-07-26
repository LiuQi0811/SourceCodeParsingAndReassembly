// =====================================================================
// SpeechCodecsPage.js —— Web Speech + WebCodecs 实验室
// 演示 MDN：
//   1. SpeechSynthesis / SpeechSynthesisUtterance / SpeechSynthesisVoice —— 语音合成（TTS）
//      speak / cancel / pause / resume / getVoices / voiceschanged
//   2. SpeechRecognition —— 语音识别（ASR）
//      new SpeechRecognition() / webkitSpeechRecognition()，start/stop/abort
//   3. VideoEncoder / VideoDecoder / EncodedVideoChunk / VideoFrame —— 视频编解码
//   4. AudioEncoder / AudioDecoder / EncodedAudioChunk / AudioData —— 音频编解码
//   5. ImageDecoder —— 图像解码（decode / tracks / tracks.ready）
// 说明：Web Speech API 与 WebCodecs API 均仅在真实浏览器中可用，jsdom / Node
//       环境全部 typeof 检测为 undefined。所有 API 调用前做 typeof 能力检测，
//       不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// 1x1 透明 PNG 字节（含 signature + IHDR + IDAT + IEND），用于 Card 6 的 ImageDecoder 演示
// 真实浏览器中可被 ImageDecoder 正确解码为 1x1 VideoFrame
const PNG_1X1_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, // bitdepth=8, colortype=6(RGBA)
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
  0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82, // IEND chunk
]);

export class SpeechCodecsPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：语音合成（TTS）
      ttsInfo: '',
      // Card 2：getVoices 列表
      voicesInfo: '',
      // Card 3：语音识别（ASR）
      recognitionInfo: '',
      // Card 4：VideoEncoder + EncodedVideoChunk
      videoEncoderInfo: '',
      // Card 5：VideoDecoder
      videoDecoderInfo: '',
      // Card 6：ImageDecoder
      imageDecoderInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._utterance = null;        // Card 1 当前 SpeechSynthesisUtterance
    this._recognition = null;      // Card 3 当前 SpeechRecognition
    this._videoEncoder = null;     // Card 4 VideoEncoder
    this._videoDecoder = null;     // Card 5 VideoDecoder
    this._imageDecoder = null;     // Card 6 ImageDecoder
    this._encodedChunks = [];      // Card 4 编码产出的 EncodedVideoChunk 列表

    // 一次性能力检测：Web Speech + WebCodecs 全家桶
    const hasSS = typeof speechSynthesis !== 'undefined';
    const hasSSU = typeof SpeechSynthesisUtterance !== 'undefined';
    const hasSSV = typeof SpeechSynthesisVoice !== 'undefined';
    const hasSR = typeof SpeechRecognition !== 'undefined' || typeof webkitSpeechRecognition !== 'undefined';
    const hasVE = typeof VideoEncoder !== 'undefined';
    const hasVD = typeof VideoDecoder !== 'undefined';
    const hasAE = typeof AudioEncoder !== 'undefined';
    const hasAD = typeof AudioDecoder !== 'undefined';
    const hasEVC = typeof EncodedVideoChunk !== 'undefined';
    const hasEAC = typeof EncodedAudioChunk !== 'undefined';
    const hasVF = typeof VideoFrame !== 'undefined';
    const hasAudioData = typeof AudioData !== 'undefined';
    const hasID = typeof ImageDecoder !== 'undefined';

    const c = (name, has) => `${name} ${has ? '✓' : '✗'}`;
    const parts = [
      c('speechSynthesis', hasSS), c('SpeechSynthesisUtterance', hasSSU),
      c('SpeechSynthesisVoice', hasSSV), c('SpeechRecognition', hasSR),
      c('VideoEncoder', hasVE), c('VideoDecoder', hasVD),
      c('AudioEncoder', hasAE), c('AudioDecoder', hasAD),
      c('EncodedVideoChunk', hasEVC), c('EncodedAudioChunk', hasEAC),
      c('VideoFrame', hasVF), c('AudioData', hasAudioData),
      c('ImageDecoder', hasID),
    ];

    const anySpeech = hasSS || hasSSU || hasSR;
    const anyCodecs = hasVE || hasVD || hasVF || hasID;
    const summary = (anySpeech || anyCodecs)
      ? `Web Speech + WebCodecs 能力检测：${parts.join(' · ')}。当前环境部分能力可用，可点击各卡片按钮体验。`
      : `Web Speech + WebCodecs 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）均不支持 Web Speech API 与 WebCodecs API，所有按钮点击将仅记日志说明，不会抛异常。请用真实浏览器（Chrome/Edge）打开本页可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(anySpeech || anyCodecs ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasSS) this._addLog('warn', 'speechSynthesis 不可用（jsdom/Node 不支持，需真实浏览器）');
    if (!hasSR) this._addLog('warn', 'SpeechRecognition 不可用（仅 Chrome/Edge 支持，需 HTTPS 或 localhost）');
    if (!hasVE || !hasVD) this._addLog('warn', 'VideoEncoder/Decoder 不可用（WebCodecs 仅浏览器支持，需 HTTPS）');
    if (!hasID) this._addLog('warn', 'ImageDecoder 不可用（WebCodecs 仅浏览器支持）');
  }

  componentWillUnmount() {
    // 关闭语音识别（abort 立即停止并触发 end，不抛异常）
    if (this._recognition) {
      try { this._recognition.abort(); } catch { /* noop */ }
      this._recognition = null;
    }
    // 取消正在播报的 utterance（清空待播队列）
    if (typeof speechSynthesis !== 'undefined') {
      try { speechSynthesis.cancel(); } catch { /* noop */ }
    }
    this._utterance = null;
    // 关闭 VideoEncoder / VideoDecoder / ImageDecoder（统一 try/catch 释放）
    for (const obj of [this._videoEncoder, this._videoDecoder, this._imageDecoder]) {
      if (obj) { try { obj.close?.(); } catch { /* noop */ } }
    }
    this._videoEncoder = null;
    this._videoDecoder = null;
    this._imageDecoder = null;
    this._encodedChunks = [];
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

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    return {
      speechSynthesis: typeof speechSynthesis !== 'undefined',
      utterance: typeof SpeechSynthesisUtterance !== 'undefined',
      voice: typeof SpeechSynthesisVoice !== 'undefined',
      recognition: typeof SpeechRecognition !== 'undefined' || typeof webkitSpeechRecognition !== 'undefined',
      videoEncoder: typeof VideoEncoder !== 'undefined',
      videoDecoder: typeof VideoDecoder !== 'undefined',
      audioEncoder: typeof AudioEncoder !== 'undefined',
      audioDecoder: typeof AudioDecoder !== 'undefined',
      encodedVideoChunk: typeof EncodedVideoChunk !== 'undefined',
      encodedAudioChunk: typeof EncodedAudioChunk !== 'undefined',
      videoFrame: typeof VideoFrame !== 'undefined',
      audioData: typeof AudioData !== 'undefined',
      imageDecoder: typeof ImageDecoder !== 'undefined',
    };
  }

  // =================== Card 1：语音合成（TTS） ===================

  // speechSynthesis.speak(utterance) → 异步开始播报
  // SpeechSynthesisUtterance：text / lang / rate / pitch / volume / voice
  _speak() {
    const caps = this._caps();
    if (!caps.speechSynthesis || !caps.utterance) {
      this._addLog('warn', 'speechSynthesis / SpeechSynthesisUtterance 不可用，请用真实浏览器（Chrome/Edge）');
      this.setState({ ttsInfo: '当前测试环境不支持 SpeechSynthesis，请用真实浏览器打开本页以播报语音。' });
      return;
    }
    try {
      // 先取消上一段，避免队列堆积
      speechSynthesis.cancel();
      const text = '你好，这是来自 Web Speech API 的语音合成演示。';
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 1.0;    // 语速：0.1 ~ 10，默认 1
      u.pitch = 1.0;   // 音高：0 ~ 2，默认 1
      u.volume = 1.0;  // 音量：0 ~ 1，默认 1
      // 监听事件：start / end / pause / resume / mark / boundary / error
      u.onstart = () => this._addLog('tts', 'onstart：开始播报');
      u.onend = () => this._addLog('tts', 'onend：播报结束');
      u.onpause = () => this._addLog('tts', 'onpause：已暂停');
      u.onresume = () => this._addLog('tts', 'onresume：已恢复');
      u.onboundary = (e) => this._addLog('tts', `onboundary：charIndex=${e.charIndex}（到达词/句边界）`);
      u.onerror = (e) => this._addLog('warn', `onerror：${e.error}`);
      this._utterance = u;
      speechSynthesis.speak(u);
      this.setState({
        ttsInfo:
          `new SpeechSynthesisUtterance("${text}")\n` +
          `utterance.lang = "${u.lang}" / rate = ${u.rate} / pitch = ${u.pitch} / volume = ${u.volume}\n` +
          `speechSynthesis.speak(utterance) ✓\n` +
          `speaking = ${speechSynthesis.speaking} / paused = ${speechSynthesis.paused} / pending = ${speechSynthesis.pending}\n` +
          `事件：onstart / onend / onpause / onresume / onboundary / onerror\n` +
          `说明：speak() 异步开始播报；utterance 可设 voice（来自 getVoices()）。`,
      });
      this._addLog('tts', `speak() 调用：text="${text}"，lang=${u.lang}`);
    } catch (err) {
      this._addLog('warn', `speak 失败：${err.name} - ${err.message}`);
    }
  }

  // speechSynthesis.cancel() → 立即停止播报并清空待播队列
  _cancelSpeaking() {
    if (!this._caps().speechSynthesis) {
      this._addLog('warn', 'speechSynthesis 不可用');
      return;
    }
    try {
      const before = `speaking=${speechSynthesis.speaking}, paused=${speechSynthesis.paused}, pending=${speechSynthesis.pending}`;
      speechSynthesis.cancel();
      const after = `speaking=${speechSynthesis.speaking}, paused=${speechSynthesis.paused}, pending=${speechSynthesis.pending}`;
      this._utterance = null;
      this.setState({
        ttsInfo:
          `speechSynthesis.cancel()\n` +
          `取消前：${before}\n` +
          `取消后：${after}\n` +
          `说明：cancel() 立即停止当前播报并清空待播队列，触发 onend。`,
      });
      this._addLog('tts', `cancel()：${before} → ${after}`);
    } catch (err) {
      this._addLog('warn', `cancel 失败：${err.name} - ${err.message}`);
    }
  }

  // speechSynthesis.pause() / resume() —— 暂停与恢复
  _pauseSpeaking() {
    if (!this._caps().speechSynthesis) {
      this._addLog('warn', 'speechSynthesis 不可用');
      return;
    }
    try {
      speechSynthesis.pause();
      this.setState({
        ttsInfo:
          `speechSynthesis.pause()\n` +
          `paused = ${speechSynthesis.paused}\n` +
          `说明：pause() 暂停当前播报，可被 resume() 恢复；部分浏览器在长文本下行为不一致。`,
      });
      this._addLog('tts', `pause()：paused=${speechSynthesis.paused}`);
    } catch (err) {
      this._addLog('warn', `pause 失败：${err.name} - ${err.message}`);
    }
  }

  _resumeSpeaking() {
    if (!this._caps().speechSynthesis) {
      this._addLog('warn', 'speechSynthesis 不可用');
      return;
    }
    try {
      speechSynthesis.resume();
      this.setState({
        ttsInfo:
          `speechSynthesis.resume()\n` +
          `paused = ${speechSynthesis.paused}\n` +
          `说明：resume() 恢复已暂停的播报。`,
      });
      this._addLog('tts', `resume()：paused=${speechSynthesis.paused}`);
    } catch (err) {
      this._addLog('warn', `resume 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. SpeechSynthesis 语音合成（TTS）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.speechSynthesis ? 'success' : 'error' }, caps.speechSynthesis ? 'speechSynthesis ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'speak / cancel / pause'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'speechSynthesis.speak(utterance) 异步播报文本；cancel() 立即停止并清空队列；pause() / resume() 暂停与恢复。SpeechSynthesisUtterance 字段：text / lang / rate（0.1-10）/ pitch（0-2）/ volume（0-1）/ voice（来自 getVoices()）。事件：start / end / pause / resume / mark / boundary / error。speechSynthesis.speaking / paused / pending 反映当前队列状态。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('speak', { type: 'primary', size: 'sm', disabled: !caps.speechSynthesis || !caps.utterance, onClick: () => this._speak() }),
          this._btn('cancel', { danger: true, size: 'sm', disabled: !caps.speechSynthesis, onClick: () => this._cancelSpeaking() }),
          this._btn('pause', { size: 'sm', disabled: !caps.speechSynthesis, onClick: () => this._pauseSpeaking() }),
          this._btn('resume', { size: 'sm', disabled: !caps.speechSynthesis, onClick: () => this._resumeSpeaking() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'TTS 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } },
          h('code', {}, s.ttsInfo || '（点击 speak 开始播报）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const u = new SpeechSynthesisUtterance('你好');
u.lang = 'zh-CN';  u.rate = 1.0;  u.pitch = 1.0;  u.volume = 1.0;
u.onend = () => console.log('播报结束');
speechSynthesis.speak(u);            // 入队播报
speechSynthesis.pause();             // 暂停
speechSynthesis.resume();            // 恢复
speechSynthesis.cancel();            // 立即停止并清空队列`)),
        h(Alert, {
          type: 'info',
          message: 'speechSynthesis 是浏览器原生 TTS 引擎',
          description: '无需任何外部服务，直接调用浏览器/操作系统的语音合成能力。voices 通常异步加载，首次 getVoices() 可能返回空数组，需监听 voiceschanged 事件（见 Card 2）。Chrome/Edge/Safari 均支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：getVoices 列表 ===================

  // speechSynthesis.getVoices() → SpeechSynthesisVoice[]
  // voiceschanged 事件：voice 列表异步加载完成时触发
  _loadVoices() {
    const caps = this._caps();
    if (!caps.speechSynthesis) {
      this._addLog('warn', 'speechSynthesis 不可用');
      return;
    }
    try {
      const renderList = (voices) => {
        const lines = voices.map((v, i) =>
          `[${i}] name="${v.name}" lang="${v.lang}" default=${v.default} localService=${v.localService} voiceURI="${v.voiceURI}"`,
        );
        this.setState({
          voicesInfo:
            `speechSynthesis.getVoices() → SpeechSynthesisVoice[${voices.length}]\n` +
            `${lines.join('\n')}\n\n` +
            `说明：SpeechSynthesisVoice 字段：name（语音名）/ lang（BCP 47 标签）/ voiceURI（唯一标识）/ default（是否默认）/ localService（本地引擎为 true，false 为云端）。`,
        });
        this._addLog('voices', `getVoices() 返回 ${voices.length} 个 voice`);
      };
      let voices = speechSynthesis.getVoices();
      if (voices.length === 0) {
        // 首次返回空：注册 voiceschanged 监听，触发后重新取
        speechSynthesis.onvoiceschanged = () => renderList(speechSynthesis.getVoices());
        this._addLog('voices', 'getVoices() 首次返回空，已注册 voiceschanged 监听');
        this.setState({ voicesInfo: 'getVoices() 首次返回空数组，已注册 voiceschanged 事件，等待浏览器加载 voice…' });
      } else {
        renderList(voices);
      }
    } catch (err) {
      this._addLog('warn', `getVoices 失败：${err.name} - ${err.message}`);
    }
  }

  // 演示把第一个 default voice 设到 utterance.voice
  _pickDefaultVoice() {
    const caps = this._caps();
    if (!caps.speechSynthesis || !caps.utterance) {
      this._addLog('warn', 'speechSynthesis / SpeechSynthesisUtterance 不可用');
      return;
    }
    try {
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) {
        this._addLog('warn', 'getVoices() 为空，请先点击「加载 voices」并等待 voiceschanged');
        this.setState({ voicesInfo: '请先点击「加载 voices」并等待 voiceschanged 事件后再选 voice。' });
        return;
      }
      const def = voices.find((v) => v.default) || voices[0];
      const u = new SpeechSynthesisUtterance('已绑定默认 voice');
      u.voice = def;
      this._utterance = u;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      this.setState({
        voicesInfo:
          `已选取 default voice 并绑定到 utterance.voice：\n` +
          `voice.name = "${def.name}" / lang = "${def.lang}" / voiceURI = "${def.voiceURI}"\n` +
          `voice.default = ${def.default} / localService = ${def.localService}\n` +
          `new SpeechSynthesisUtterance("已绑定默认 voice") → utterance.voice = def → speak() ✓`,
      });
      this._addLog('voices', `已绑定 voice: ${def.name}（${def.lang}）并 speak()`);
    } catch (err) {
      this._addLog('warn', `pick voice 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. SpeechSynthesisVoice 列表（getVoices）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.voice ? 'success' : 'error' }, caps.voice ? 'Voice ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'voiceschanged'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'speechSynthesis.getVoices() 返回 SpeechSynthesisVoice[]。voice 字段：name（语音名）/ lang（BCP 47 标签，如 zh-CN、en-US）/ voiceURI（唯一标识）/ default（是否默认 voice）/ localService（本地引擎为 true，云端为 false）。voices 异步加载，首次调用可能返回空数组，需监听 voiceschanged 事件后再取。可把 voice 赋给 utterance.voice 切换发音人。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('加载 voices', { type: 'primary', size: 'sm', disabled: !caps.speechSynthesis, onClick: () => this._loadVoices() }),
          this._btn('选默认 voice 并 speak', { size: 'sm', disabled: !caps.speechSynthesis || !caps.utterance, onClick: () => this._pickDefaultVoice() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'voice 列表：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.voicesInfo || '（点击「加载 voices」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) {                 // 首次返回空
    speechSynthesis.onvoiceschanged = loadVoices;  // 异步加载
    return;
  }
  const zh = voices.find(v => v.lang.startsWith('zh'));
  const u = new SpeechSynthesisUtterance('你好');
  u.voice = zh || voices[0];                 // 绑定发音人
  speechSynthesis.speak(u);
}
loadVoices();`)),
        h(Alert, {
          type: 'warning',
          message: 'voiceschanged 是异步加载的关键事件',
          description: '页面刚加载时 getVoices() 常返回空数组，浏览器会在 voice 引擎就绪后触发 voiceschanged。务必监听该事件再取 voices，否则会拿到空列表。Chrome 与 Safari 触发时机略有差异。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：SpeechRecognition 语音识别 ===================

  // new SpeechRecognition() 或 new webkitSpeechRecognition()
  // lang / continuous / interimResults / maxAlternatives
  _startRecognition() {
    const caps = this._caps();
    if (!caps.recognition) {
      this._addLog('warn', 'SpeechRecognition 不可用（仅 Chrome/Edge 支持，需 HTTPS 或 localhost）');
      this.setState({ recognitionInfo: '当前测试环境不支持 SpeechRecognition，请用 Chrome/Edge 浏览器（HTTPS 或 localhost）打开本页。' });
      return;
    }
    try {
      const SR = typeof SpeechRecognition !== 'undefined' ? SpeechRecognition : webkitSpeechRecognition;
      const r = new SR();
      r.lang = 'zh-CN';            // 识别语言（BCP 47）
      r.continuous = false;        // false：单次识别；true：连续识别
      r.interimResults = true;     // true：返回中间结果（未稳定）
      r.maxAlternatives = 3;       // 每条结果最多返回的候选数
      // 事件：audiostart / audioend / speechstart / speechend / result / nomatch / error / end
      r.onaudiostart = () => this._addLog('asr', 'onaudiostart：音频采集开始');
      r.onaudioend = () => this._addLog('asr', 'onaudioend：音频采集结束');
      r.onspeechstart = () => this._addLog('asr', 'onspeechstart：检测到语音');
      r.onspeechend = () => this._addLog('asr', 'onspeechend：语音停止');
      r.onresult = (e) => {
        // e.results 是 SpeechRecognitionResultList；e.resultIndex 是当前结果起点
        const resultList = e.results;
        const idx = e.resultIndex;
        const last = resultList[idx];
        const top = last[0];       // 第一候选（confidence 最高）
        this._addLog('asr', `onresult：transcript="${top.transcript}" confidence=${top.confidence.toFixed(2)} isFinal=${last.isFinal}`);
        // 拼接所有结果的 transcript
        let fullText = '';
        for (let i = 0; i < resultList.length; i++) fullText += resultList[i][0].transcript;
        this.setState({
          recognitionInfo:
            `event.results = SpeechRecognitionResultList（length=${resultList.length}）\n` +
            `event.resultIndex = ${idx}\n` +
            `本条 transcript = "${top.transcript}" / confidence = ${top.confidence} / isFinal = ${last.isFinal}\n` +
            `候选数 = ${last.length}（maxAlternatives = ${r.maxAlternatives}）\n` +
            `累计 transcript = "${fullText}"\n` +
            `说明：interimResults=true 时 isFinal=false 为中间结果；continuous=true 时多次 onresult。`,
        });
      };
      r.onnomatch = () => this._addLog('warn', 'onnomatch：未识别到匹配内容');
      r.onerror = (e) => this._addLog('warn', `onerror：${e.error}（如 not-allowed / no-speech / network）`);
      r.onend = () => this._addLog('asr', 'onend：识别会话结束');
      this._recognition = r;
      r.start();
      this.setState({
        recognitionInfo:
          `new ${SR.name}()\n` +
          `recognition.lang = "${r.lang}" / continuous = ${r.continuous} / interimResults = ${r.interimResults} / maxAlternatives = ${r.maxAlternatives}\n` +
          `recognition.start() ✓\n` +
          `事件：onaudiostart / onaudioend / onspeechstart / onspeechend / onresult / onnomatch / onerror / onend\n` +
          `（请对着麦克风说话，识别结果会出现在此区域）`,
      });
      this._addLog('asr', `start() 调用：lang=${r.lang}, continuous=${r.continuous}, interimResults=${r.interimResults}`);
    } catch (err) {
      this._addLog('warn', `start 失败：${err.name} - ${err.message}（可能未授权麦克风或非 HTTPS）`);
    }
  }

  // recognition.stop() → 请求停止，仍会触发 onresult / onend
  _stopRecognition() {
    if (!this._recognition) {
      this._addLog('warn', '请先点击「开始识别」');
      return;
    }
    try {
      this._recognition.stop();
      this._addLog('asr', 'stop()：请求停止识别（已采集的音频仍会触发 onresult / onend）');
    } catch (err) {
      this._addLog('warn', `stop 失败：${err.name} - ${err.message}`);
    }
  }

  // recognition.abort() → 立即中止，不触发 onresult，触发 onend
  _abortRecognition() {
    if (!this._recognition) {
      this._addLog('warn', '请先点击「开始识别」');
      return;
    }
    try {
      this._recognition.abort();
      this._addLog('asr', 'abort()：立即中止识别（不触发 onresult，仅触发 onend）');
    } catch (err) {
      this._addLog('warn', `abort 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. SpeechRecognition 语音识别（ASR）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.recognition ? 'success' : 'error' }, caps.recognition ? 'Recognition ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'start / stop / abort'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new SpeechRecognition()（或 webkitSpeechRecognition）创建识别器。lang 设置识别语言（BCP 47）；continuous=true 连续识别；interimResults=true 返回中间结果；maxAlternatives 限制每条候选数。start() 开始、stop() 请求停止（仍触发 onresult）、abort() 立即中止。事件：audiostart / audioend / speechstart / speechend / result / nomatch / error / end。event.results 是 SpeechRecognitionResultList，每项含 transcript / confidence / isFinal。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('开始识别', { type: 'primary', size: 'sm', disabled: !caps.recognition, onClick: () => this._startRecognition() }),
          this._btn('stop', { size: 'sm', disabled: !caps.recognition, onClick: () => this._stopRecognition() }),
          this._btn('abort', { danger: true, size: 'sm', disabled: !caps.recognition, onClick: () => this._abortRecognition() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '识别结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.recognitionInfo || '（点击「开始识别」并允许麦克风）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const r = new SR();
r.lang = 'zh-CN';  r.continuous = false;  r.interimResults = true;  r.maxAlternatives = 1;
r.onresult = (e) => {
  const last = e.results[e.results.length - 1];
  console.log(last[0].transcript, last.isFinal);
};
r.onerror = (e) => console.error(e.error);
r.start();   // 需 HTTPS 或 localhost + 麦克风授权`)),
        h(Alert, {
          type: 'warning',
          message: 'SpeechRecognition 需要 HTTPS 与麦克风授权',
          description: '浏览器仅在安全上下文（HTTPS 或 localhost）下提供 SpeechRecognition，且首次调用 start() 会弹出麦克风授权提示。onerror 常见 error：not-allowed（未授权）/ no-speech（无语音）/ network（网络问题，因 Chrome 走云端识别）。Firefox 几乎不支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：VideoEncoder + EncodedVideoChunk ===================

  // new VideoEncoder({ output(chunk, metadata), error(e) })
  // encoder.configure({ codec, width, height, bitrate, framerate })
  _createVideoEncoder() {
    const caps = this._caps();
    if (!caps.videoEncoder) {
      this._addLog('warn', 'VideoEncoder 不可用（WebCodecs 仅浏览器支持，需 HTTPS）');
      return;
    }
    try {
      this._encodedChunks = [];
      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          this._encodedChunks.push(chunk);
          this._addLog('encode', `output chunk：type="${chunk.type}" timestamp=${chunk.timestamp} duration=${chunk.duration} byteLength=${chunk.byteLength}`);
          if (metadata && metadata.decoderConfig) {
            this._addLog('encode', `metadata.decoderConfig：${JSON.stringify(metadata.decoderConfig).slice(0, 80)}`);
          }
        },
        error: (e) => this._addLog('warn', `VideoEncoder error：${e.message}`),
      });
      encoder.configure({
        codec: 'vp8',       // 也可 vp9 / avc1.42E01E / av01.0.05M.08 等
        width: 320,
        height: 240,
        bitrate: 500_000,   // 500 kbps
        framerate: 30,
      });
      this._videoEncoder = encoder;
      this.setState({
        videoEncoderInfo:
          `new VideoEncoder({ output(chunk, metadata), error(e) })\n` +
          `encoder.configure({ codec: "vp8", width: 320, height: 240, bitrate: 500000, framerate: 30 }) ✓\n` +
          `encoder.encodeQueueSize = ${encoder.encodeQueueSize}\n` +
          `说明：codec 支持 vp8/vp9/avc1/av01 等（因浏览器/平台而异）；bitrate 单位 bits/s；output 回调收到 EncodedVideoChunk + metadata（含 decoderConfig）。`,
      });
      this._addLog('encode', `VideoEncoder 已创建并 configure（vp8 320x240 @30fps 500kbps）`);
    } catch (err) {
      this._addLog('warn', `创建 VideoEncoder 失败：${err.name} - ${err.message}`);
    }
  }

  // new VideoFrame(canvas, { timestamp, duration }) → encoder.encode(frame, { keyFrame })
  // await encoder.flush() → 触发所有 output
  async _encodeMockFrame() {
    const caps = this._caps();
    if (!caps.videoEncoder || !caps.videoFrame) {
      this._addLog('warn', 'VideoEncoder / VideoFrame 不可用');
      return;
    }
    if (!this._videoEncoder) {
      this._addLog('warn', '请先点击「创建 VideoEncoder」');
      return;
    }
    try {
      // 用 canvas 构造一个 mock VideoFrame（真实场景下也可从 ImageBitmap / VideoFrame 等）
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#4f8cff';
      ctx.fillRect(0, 0, 320, 240);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.fillText('WebCodecs', 100, 120);
      const frame = new VideoFrame(canvas, { timestamp: 0, duration: 33_333 });
      const fmt = frame.format, cw = frame.codedWidth, ch = frame.codedHeight;
      this._videoEncoder.encode(frame, { keyFrame: true });
      this._addLog('encode', `encode(frame, { keyFrame: true })：format=${fmt} codedWidth=${cw}x${ch}`);
      frame.close();   // 编码后立即关闭，释放显存
      await this._videoEncoder.flush();
      const chunk = this._encodedChunks[0];
      const chunkText = chunk
        ? `chunk.type="${chunk.type}" timestamp=${chunk.timestamp} duration=${chunk.duration} byteLength=${chunk.byteLength}`
        : '（无 chunk 产出）';
      this.setState({
        videoEncoderInfo:
          `new VideoFrame(canvas, { timestamp: 0, duration: 33333 })\n` +
          `frame.format = ${fmt}, codedWidth = ${cw}, codedHeight = ${ch}\n` +
          `encoder.encode(frame, { keyFrame: true }) ✓\n` +
          `frame.close() ✓（编码后立即释放显存）\n` +
          `await encoder.flush() ✓\n` +
          `产出 EncodedVideoChunk：${chunkText}\n` +
          `说明：flush() resolve 时所有 output 已触发；chunk.type ∈ 'key'|'delta'；chunk.copyTo(dest) 拷贝字节。`,
      });
      this._addLog('encode', `flush() 完成：共 ${this._encodedChunks.length} 个 chunk`);
    } catch (err) {
      this._addLog('warn', `encode 失败：${err.name} - ${err.message}`);
    }
  }

  // encoder.reset() → 清空待编码队列，可重新 configure 继续使用
  _resetVideoEncoder() {
    if (!this._videoEncoder) {
      this._addLog('warn', '请先点击「创建 VideoEncoder」');
      return;
    }
    try {
      this._videoEncoder.reset();
      this._encodedChunks = [];
      this.setState({
        videoEncoderInfo:
          `encoder.reset() ✓\n` +
          `说明：reset 清空待编码队列，可重新 configure 继续使用；close() 则彻底释放编码器（不可再用）。`,
      });
      this._addLog('encode', 'reset()：已清空待编码队列');
    } catch (err) {
      this._addLog('warn', `reset 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. VideoEncoder + EncodedVideoChunk',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.videoEncoder ? 'success' : 'error' }, caps.videoEncoder ? 'VideoEncoder ✓' : '不可用'),
        h(Tag, { color: caps.encodedVideoChunk ? 'primary' : 'warning' }, caps.encodedVideoChunk ? 'EncodedChunk ✓' : 'Chunk ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new VideoEncoder({ output(chunk, metadata), error(e) }) 创建视频编码器；encoder.configure({ codec, width, height, bitrate, framerate }) 配置；encoder.encode(frame, { keyFrame }) 编码 VideoFrame；await encoder.flush() 等待所有 output；encoder.reset() 清空队列；encoder.close() 释放；encoder.encodeQueueSize 当前队列长度。output 回调收到 EncodedVideoChunk（type ∈ key/delta，含 timestamp/duration/byteLength/copyTo）+ metadata（含 decoderConfig）。VideoFrame 来源：canvas / ImageBitmap / 另一个 VideoFrame。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 VideoEncoder', { type: 'primary', size: 'sm', disabled: !caps.videoEncoder, onClick: () => this._createVideoEncoder() }),
          this._btn('encode mock frame', { type: 'primary', size: 'sm', disabled: !caps.videoEncoder || !caps.videoFrame, onClick: () => this._encodeMockFrame() }),
          this._btn('reset', { size: 'sm', disabled: !caps.videoEncoder, onClick: () => this._resetVideoEncoder() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '编码结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.videoEncoderInfo || '（点击「创建 VideoEncoder」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`const encoder = new VideoEncoder({
  output: (chunk, meta) => { /* chunk: EncodedVideoChunk */ },
  error: (e) => console.error(e),
});
encoder.configure({ codec: 'vp8', width: 640, height: 480, bitrate: 1_000_000, framerate: 30 });
const frame = new VideoFrame(canvas, { timestamp: 0, duration: 33333 });
encoder.encode(frame, { keyFrame: true });  frame.close();
await encoder.flush();   // chunk.copyTo(buf) 拷贝字节；chunk.type === 'key'|'delta'
encoder.reset();         // 清空队列，可重新 configure
encoder.close();         // 彻底释放`)),
        h(Alert, {
          type: 'info',
          message: 'VideoFrame 必须显式 close() 释放显存',
          description: 'VideoFrame 持有 GPU/系统内存资源，使用完（编码或解码后）必须调用 frame.close() 释放，否则会内存泄漏。也可 frame.clone() 复制一份独立帧。allocationSize() 返回拷贝所需字节，copyTo(buffer) 拷贝像素数据。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：VideoDecoder ===================

  // new VideoDecoder({ output(frame), error(e) })
  // decoder.configure({ codec, codedWidth, codedHeight, description? })
  _createVideoDecoder() {
    const caps = this._caps();
    if (!caps.videoDecoder) {
      this._addLog('warn', 'VideoDecoder 不可用（WebCodecs 仅浏览器支持）');
      return;
    }
    try {
      const decoder = new VideoDecoder({
        output: (frame) => {
          this._addLog('decode', `output frame：format=${frame.format} ${frame.codedWidth}x${frame.codedHeight} timestamp=${frame.timestamp} duration=${frame.duration}`);
          frame.close();   // 解码后立即释放
        },
        error: (e) => this._addLog('warn', `VideoDecoder error：${e.message}`),
      });
      decoder.configure({ codec: 'vp8', codedWidth: 320, codedHeight: 240 });
      this._videoDecoder = decoder;
      this.setState({
        videoDecoderInfo:
          `new VideoDecoder({ output(frame), error(e) })\n` +
          `decoder.configure({ codec: "vp8", codedWidth: 320, codedHeight: 240 }) ✓\n` +
          `decoder.decodeQueueSize = ${decoder.decodeQueueSize}\n` +
          `说明：output 回调收到解码后的 VideoFrame，使用完必须 frame.close() 释放显存；configure 时可传 description（来自 VideoEncoder metadata.decoderConfig）以适配特定 codec。`,
      });
      this._addLog('decode', `VideoDecoder 已创建并 configure（vp8 320x240）`);
    } catch (err) {
      this._addLog('warn', `创建 VideoDecoder 失败：${err.name} - ${err.message}`);
    }
  }

  // decoder.decode(chunk) → 入队；await decoder.flush() → 触发所有 output
  async _decodeMockChunk() {
    const caps = this._caps();
    if (!caps.videoDecoder || !caps.encodedVideoChunk) {
      this._addLog('warn', 'VideoDecoder / EncodedVideoChunk 不可用');
      return;
    }
    if (!this._videoDecoder) {
      this._addLog('warn', '请先点击「创建 VideoDecoder」');
      return;
    }
    try {
      // 优先用 Card 4 编码产出的真实 chunk；没有则构造 mock chunk（仅 NAL 起始码，可能解码失败）
      const realChunk = this._encodedChunks[0];
      let chunkDesc = '';
      if (realChunk) {
        this._videoDecoder.decode(realChunk);
        chunkDesc = `使用 Card 4 编码产出的真实 chunk：type="${realChunk.type}" timestamp=${realChunk.timestamp} byteLength=${realChunk.byteLength}`;
        this._addLog('decode', `decode(realChunk)：type="${realChunk.type}" byteLength=${realChunk.byteLength}`);
      } else {
        const mock = new EncodedVideoChunk({ type: 'key', timestamp: 0, duration: 33_333, data: new Uint8Array([0x00, 0x00, 0x00, 0x01]) });
        this._videoDecoder.decode(mock);
        chunkDesc = `无 Card 4 真实 chunk，使用 mock chunk：type="key" timestamp=0 byteLength=${mock.byteLength}（仅 NAL 起始码，可能触发 error）`;
        this._addLog('decode', `decode(mock chunk)：type="key" byteLength=${mock.byteLength}`);
      }
      await this._videoDecoder.flush();
      this.setState({
        videoDecoderInfo:
          `decoder.decode(chunk) ✓\n` +
          `${chunkDesc}\n` +
          `await decoder.flush() ✓\n` +
          `说明：decode 把 EncodedVideoChunk 入队；flush 触发所有 output 返回 VideoFrame。若 chunk 非法触发 error 回调（仍 resolve flush）。真实场景：Card 4 编码后把 chunk 传给 Card 5 解码，形成 encode→decode 闭环。`,
      });
      this._addLog('decode', `flush() 完成`);
    } catch (err) {
      this._addLog('warn', `decode 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. VideoDecoder',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.videoDecoder ? 'success' : 'error' }, caps.videoDecoder ? 'VideoDecoder ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'decode / flush'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new VideoDecoder({ output(frame), error(e) }) 创建视频解码器；decoder.configure({ codec, codedWidth, codedHeight, description? }) 配置；decoder.decode(chunk) 把 EncodedVideoChunk 入队解码；await decoder.flush() 等待所有 output；decoder.reset() 清空队列；decoder.close() 释放。output 回调收到解码后的 VideoFrame（必须 close()）。AudioEncoder / AudioDecoder / EncodedAudioChunk / AudioData 用法完全同构，仅 codec 不同（如 mp4a.40.2 / opus）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 VideoDecoder', { type: 'primary', size: 'sm', disabled: !caps.videoDecoder, onClick: () => this._createVideoDecoder() }),
          this._btn('decode mock chunk', { type: 'primary', size: 'sm', disabled: !caps.videoDecoder || !caps.encodedVideoChunk, onClick: () => this._decodeMockChunk() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '解码结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.videoDecoderInfo || '（点击「创建 VideoDecoder」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（含 AudioDecoder 同构）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`const decoder = new VideoDecoder({
  output: (frame) => { frame.close(); },   // VideoFrame 用完必须 close()
  error: (e) => console.error(e),
});
decoder.configure({ codec: 'vp8', codedWidth: 320, codedHeight: 240 });
decoder.decode(encodedChunk);          // EncodedVideoChunk 入队
await decoder.flush();                 // 等待所有 output
// AudioDecoder 同构：
const ad = new AudioDecoder({ output: (d) => d.close(), error: console.error });
ad.configure({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2 });
ad.decode(audioChunk); await ad.flush();`)),
        h(Alert, {
          type: 'info',
          message: 'WebCodecs 是比 MediaRecorder 更底层的编解码 API',
          description: 'WebCodecs 直接暴露浏览器底层编码器（VP8/VP9/H.264/AAC/Opus），可精确控制每帧编解码，适合实时通信、视频处理、低延迟流媒体。相比 MediaSource Extensions / MediaRecorder，无容器封装开销，可处理裸 chunk。AudioEncoder / AudioDecoder 与 Video 系列同构，仅 config 字段不同。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：ImageDecoder ===================

  // new ImageDecoder({ type, data }) → 异步解码图像
  // decoder.tracks.ready 等待轨道元数据；decoder.decode({ frameIndex }) → VideoFrame
  async _createImageDecoder() {
    const caps = this._caps();
    if (!caps.imageDecoder) {
      this._addLog('warn', 'ImageDecoder 不可用（WebCodecs 仅浏览器支持）');
      return;
    }
    try {
      const decoder = new ImageDecoder({ type: 'image/png', data: PNG_1X1_BYTES });
      this._imageDecoder = decoder;
      // 等待 tracks 元数据就绪
      await decoder.tracks.ready;
      const tracks = decoder.tracks;
      const trackCount = tracks.length;
      const lines = [];
      lines.push(`new ImageDecoder({ type: "image/png", data: Uint8Array(${PNG_1X1_BYTES.length}) })`);
      lines.push(`await decoder.tracks.ready ✓`);
      lines.push(`tracks.length = ${trackCount}`);
      if (trackCount > 0) {
        const track = tracks[0];
        lines.push(`track[0].animated = ${track.animated} / frameCount = ${track.frameCount} / type = "${track.type}"`);
      }
      // 解码第一帧
      const result = await decoder.decode({ frameIndex: 0 });
      lines.push(`await decoder.decode({ frameIndex: 0 }) → VideoFrame`);
      lines.push(`  image.format = ${result.format} / codedWidth = ${result.codedWidth} / codedHeight = ${result.codedHeight}`);
      lines.push(`  image.timestamp = ${result.timestamp} / duration = ${result.duration} / allocationSize() = ${result.allocationSize()}`);
      lines.push(`说明：decode 返回 VideoFrame（与 VideoEncoder 同源）；tracks.ready 等待轨道元数据；animated=true 时有多帧（GIF/APNG）。`);
      result.close();
      this.setState({ imageDecoderInfo: lines.join('\n') });
      this._addLog('image', `ImageDecoder decode({frameIndex:0}) 完成：${result.codedWidth}x${result.codedHeight}`);
    } catch (err) {
      this._addLog('warn', `ImageDecoder 失败：${err.name} - ${err.message}`);
      this.setState({ imageDecoderInfo: `ImageDecoder 演示失败：${err.name} - ${err.message}\n（可能字节不完整或浏览器不支持 PNG 解码）` });
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. ImageDecoder',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.imageDecoder ? 'success' : 'error' }, caps.imageDecoder ? 'ImageDecoder ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'png / gif / webp'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new ImageDecoder({ type, data }) 异步解码图像（type ∈ image/png / image/gif / image/webp / image/avif）。decoder.tracks.ready 等待轨道元数据就绪；decoder.tracks[i].animated / frameCount / type 反映轨道信息；decoder.decode({ frameIndex }) 返回 VideoFrame（与 VideoEncoder 同源，可进一步编码或绘制到 canvas）。支持 GIF/APNG 多帧动画。本卡片用 1x1 透明 PNG 字节演示解码流程。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 ImageDecoder 并 decode', { type: 'primary', size: 'sm', disabled: !caps.imageDecoder, onClick: () => this._createImageDecoder() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '解码结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.imageDecoderInfo || '（点击「创建 ImageDecoder 并 decode」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const decoder = new ImageDecoder({ type: 'image/png', data: pngBytes });
await decoder.tracks.ready;
const track = decoder.tracks[0];
console.log(track.animated, track.frameCount);
const frame = await decoder.decode({ frameIndex: 0 });
// frame: VideoFrame —— 可绘制到 canvas 或交给 VideoEncoder
ctx.drawImage(frame, 0, 0);
frame.close();
decoder.close();`)),
        h(Alert, {
          type: 'info',
          message: 'ImageDecoder 支持渐进式与多帧解码',
          description: 'ImageDecoder 可解码 PNG / GIF / WebP / AVIF / BMP 等。对动态 GIF/APNG，tracks[0].animated=true 且 frameCount>1，可循环 decode({ frameIndex }) 取每一帧。decode 返回的 VideoFrame 与视频编解码共用，便于图像→视频转码。比 <img> + canvas 更底层、可控。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志',
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'Web Speech + WebCodecs 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'Web Speech API 提供语音合成（TTS）与语音识别（ASR）；WebCodecs API 提供底层视频/音频/图像编解码。本页演示 SpeechSynthesis / SpeechRecognition / VideoEncoder / VideoDecoder / ImageDecoder。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
