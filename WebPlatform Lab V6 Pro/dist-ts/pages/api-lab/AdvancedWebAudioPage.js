// =====================================================================
// AdvancedWebAudioPage.js —— Web Audio API 深入 + 语音识别实验室
// 演示 MDN：
//   1. AudioContext 与节点拓扑（AudioContext / OfflineAudioContext / state /
//      resume / suspend / close / destination / sampleRate / currentTime / baseLatency）
//   2. 振荡器 + 增益 + 滤波器（OscillatorNode type/frequency/detune/start/stop、
//      GainNode gain、BiquadFilterNode type/frequency/Q/gain、connect 拓扑）
//   3. AudioParam 自动化 + AnalyserNode 频谱（setValueAtTime / linearRampToValueAtTime /
//      exponentialRampToValueAtTime / setTargetAtTime / setValueCurveAtTime /
//      cancelScheduledValues、fftSize / frequencyBinCount / getByteFrequencyData /
//      getByteTimeDomainData / smoothingTimeConstant）
//   4. AudioWorklet + decodeAudioData（audioWorklet.addModule / AudioWorkletNode /
//      parameters、decodeAudioData → AudioBuffer：numberOfChannels / length /
//      sampleRate / duration / getChannelData）
//   5. Web Speech API - SpeechRecognition（SpeechRecognition / webkitSpeechRecognition、
//      continuous / interimResults / lang / maxAlternatives、start / stop / abort、
//      audiostart / speechstart / speechend / result / error / end 事件、
//      SpeechRecognitionResult / SpeechRecognitionAlternative transcript/confidence、
//      SpeechGrammarList）
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime, errInfo } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
// ===================== 模块级常量 =====================
// 振荡器波形类型（custom 需 periodicWave，此处列出基础类型）
const OSC_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];
// BiquadFilterNode 全部 8 种类型
const FILTER_TYPES = [
    'lowpass', 'highpass', 'bandpass', 'lowshelf',
    'highshelf', 'peaking', 'notch', 'allpass',
];
// AudioWorklet 处理器源码：一个简单的增益处理器（演示 AudioWorkletProcessor / process / parameters）
const WORKLET_SRC = `
class GainProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'gain', defaultValue: 0.5, minValue: 0, maxValue: 1 }];
  }
  process(inputs: any, outputs: any, parameters: any){
    const input = inputs[0];
    const output = outputs[0];
    const gain = parameters.gain;
    for (let c = 0; c < output.length; ++c) {
      const inCh = input[c];
      const outCh = output[c];
      for (let i = 0; i < outCh.length; ++i) {
        const g = gain.length > 1 ? gain[i] : gain[0];
        outCh[i] = (inCh ? inCh[i] : 0) * g;
      }
    }
    return true;
  }
}
registerProcessor('gain-processor', GainProcessor);
`;
// ===================== WAV 编码辅助（生成正弦波 PCM 用于 decodeAudioData 演示）=====================
function _writeStr(view, offset, str) {
    for (let i = 0; i < str.length; i++)
        view.setUint8(offset + i, str.charCodeAt(i));
}
/** 生成一段正弦波 16-bit PCM 单声道 WAV 的 ArrayBuffer */
function generateSineWav(sampleRate, duration, freq) {
    const num = Math.floor(sampleRate * duration);
    const buf = new ArrayBuffer(44 + num * 2);
    const v = new DataView(buf);
    _writeStr(v, 0, 'RIFF');
    v.setUint32(4, 36 + num * 2, true);
    _writeStr(v, 8, 'WAVE');
    _writeStr(v, 12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); // blockAlign
    v.setUint16(34, 16, true); // bitsPerSample
    _writeStr(v, 36, 'data');
    v.setUint32(40, num * 2, true);
    for (let i = 0; i < num; i++) {
        const s = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * 0.5;
        v.setInt16(44 + i * 2, s * 0x7fff, true);
    }
    return buf;
}
export class AdvancedWebAudioPage extends Page {
    _analyser;
    _analyserRaf;
    _audioCtx;
    _autoTimer;
    _filterType;
    _freq;
    _gain;
    _inited;
    _nodes;
    _oscType;
    _oscillators;
    _recognition;
    _workletAdded;
    _workletUrl;
    initialState() {
        return {
            logs: [],
            // Card 1: AudioContext
            audioSupported: null,
            audioCtxInfo: '',
            audioState: '未创建',
            // Card 3: 自动化 + 频谱
            autoPlaying: false,
            fftSize: 0,
            frequencyBinCount: 0,
            // Card 4: Worklet + decode
            workletSupported: null,
            workletAdded: false,
            workletResult: '',
            decodeResult: '',
            // Card 5: SpeechRecognition
            speechSupported: null,
            speechRunning: false,
            speechResults: [],
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：避免 setState → rerender → componentDidMount 死循环导致 OOM。
        // 每次挂载都需要重建的演示（控件事件绑定）放在守卫之前，
        // 一次性初始化（能力检测）放在守卫之后。
        this._bindControls();
        if (this._inited)
            return;
        this._inited = true;
        // 一次性能力检测（均做 typeof / in 检测，jsdom 不可用时仅记日志）
        this._detectAudio();
        this._detectSpeech();
    }
    componentWillUnmount() {
        // 1. 取消频谱动画帧
        if (this._analyserRaf) {
            cancelAnimationFrame(this._analyserRaf);
            this._analyserRaf = null;
        }
        // 2. 清除自动化定时器
        if (this._autoTimer) {
            clearTimeout(this._autoTimer);
            this._autoTimer = null;
        }
        // 3. 停止所有振荡器并断开节点
        (this._oscillators || []).forEach((o) => {
            try {
                o.stop();
            }
            catch { /* 已停止 */ }
            try {
                o.disconnect();
            }
            catch { /* noop */ }
        });
        (this._nodes || []).forEach((n) => {
            try {
                n.disconnect();
            }
            catch { /* noop */ }
        });
        this._oscillators = [];
        this._nodes = [];
        // 4. 关闭 AudioContext
        if (this._audioCtx) {
            try {
                this._audioCtx.close();
            }
            catch { /* noop */ }
            this._audioCtx = null;
        }
        // 5. 停止 SpeechRecognition
        if (this._recognition) {
            try {
                this._recognition.abort();
            }
            catch { /* noop */ }
            this._recognition = null;
        }
        // 6. 撤销 AudioWorklet 的 Blob URL
        if (this._workletUrl) {
            try {
                URL.revokeObjectURL(this._workletUrl);
            }
            catch { /* noop */ }
            this._workletUrl = null;
        }
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
    _track(node) {
        (this._nodes = this._nodes || []).push(node);
        return node;
    }
    _trackOsc(osc) {
        (this._oscillators = this._oscillators || []).push(osc);
        return osc;
    }
    // —— 控件绑定（每次挂载都重新绑定，rerender 后元素是新的）——
    // 滑块 / 下拉仅更新实例属性 + 直接 DOM 文本，不触发 setState，避免 rerender
    _bindControls() {
        const freq = this.$('.freq-slider');
        if (freq) {
            freq.value = this._freq ?? 440;
            this.on(freq, 'input', () => {
                this._freq = Number(freq.value);
                const label = this.$('.freq-val');
                if (label)
                    label.textContent = `${this._freq} Hz`;
            });
        }
        const gain = this.$('.gain-slider');
        if (gain) {
            gain.value = this._gain ?? 0.3;
            this.on(gain, 'input', () => {
                this._gain = Number(gain.value);
                const label = this.$('.gain-val');
                if (label)
                    label.textContent = `${Math.round(this._gain * 100)}%`;
            });
        }
        const filter = this.$('.filter-select');
        if (filter) {
            filter.value = this._filterType || 'lowpass';
            this.on(filter, 'change', () => {
                this._filterType = filter.value;
                this._addLog('info', `BiquadFilterNode.type → ${filter.value}`);
            });
        }
        const osc = this.$('.osc-select');
        if (osc) {
            osc.value = this._oscType || 'sine';
            this.on(osc, 'change', () => {
                this._oscType = osc.value;
                this._addLog('info', `OscillatorNode.type → ${osc.value}`);
            });
        }
    }
    // ===================== Card 1: AudioContext 与节点拓扑 =====================
    _detectAudio() {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        const supported = typeof Ctor === 'function';
        this.setState({
            audioSupported: supported,
            logs: [...this.state.logs, {
                    type: 'audio',
                    content: supported
                        ? `AudioContext 可用（${window.AudioContext ? 'AudioContext' : 'webkitAudioContext'}），需用户手势内创建`
                        : 'AudioContext 不可用（typeof AudioContext === "undefined"）',
                    time: formatTime(),
                }].slice(-40),
        });
    }
    // 在用户手势内创建 / 恢复 AudioContext
    _ensureCtx() {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (typeof Ctor !== 'function') {
            this._addLog('error', 'AudioContext 不可用，无法创建音频上下文');
            return null;
        }
        if (!this._audioCtx) {
            this._audioCtx = new Ctor();
            this._addLog('info', `new AudioContext()：sampleRate=${this._audioCtx.sampleRate}Hz`);
        }
        if (this._audioCtx.state === 'suspended') {
            this._audioCtx.resume();
        }
        return this._audioCtx;
    }
    _createCtx() {
        const ctx = this._ensureCtx();
        if (!ctx)
            return;
        this.setState({
            audioCtxInfo: [
                `sampleRate = ${ctx.sampleRate} Hz`,
                `state = ${ctx.state}`,
                `currentTime = ${(ctx.currentTime ?? 0).toFixed(3)} s`,
                `baseLatency = ${(ctx.baseLatency ?? 0).toFixed(5)} s`,
            ].join('\n'),
            audioState: ctx.state,
        });
        this._addLog('info', `AudioContext.state=${ctx.state}, sampleRate=${ctx.sampleRate}, baseLatency=${(ctx.baseLatency ?? 0).toFixed(5)}s`);
    }
    _resumeCtx() {
        if (!this._audioCtx) {
            this._addLog('error', 'AudioContext 尚未创建');
            return;
        }
        if (typeof this._audioCtx.resume !== 'function') {
            this._addLog('error', 'AudioContext.resume 不可用');
            return;
        }
        this._audioCtx.resume().then(() => {
            this.setState({ audioState: this._audioCtx.state });
            this._addLog('info', `resume() → state=${this._audioCtx.state}`);
        }).catch((err) => this._addLog('error', `resume 失败：${errInfo(err).message}`));
    }
    _suspendCtx() {
        if (!this._audioCtx) {
            this._addLog('error', 'AudioContext 尚未创建');
            return;
        }
        if (typeof this._audioCtx.suspend !== 'function') {
            this._addLog('error', 'AudioContext.suspend 不可用');
            return;
        }
        this._audioCtx.suspend().then(() => {
            this.setState({ audioState: this._audioCtx.state });
            this._addLog('info', `suspend() → state=${this._audioCtx.state}`);
        }).catch((err) => this._addLog('error', `suspend 失败：${errInfo(err).message}`));
    }
    _closeCtx() {
        if (!this._audioCtx) {
            this._addLog('error', 'AudioContext 尚未创建');
            return;
        }
        if (typeof this._audioCtx.close !== 'function') {
            this._addLog('error', 'AudioContext.close 不可用');
            return;
        }
        this._audioCtx.close().then(() => {
            this.setState({ audioState: 'closed', audioCtxInfo: 'AudioContext 已关闭' });
            this._addLog('info', `close() → state=closed`);
            this._audioCtx = null;
        }).catch((err) => this._addLog('error', `close 失败：${errInfo(err).message}`));
    }
    _createOfflineCtx() {
        if (typeof OfflineAudioContext === 'undefined') {
            this._addLog('error', 'OfflineAudioContext 不可用（typeof OfflineAudioContext === "undefined"）');
            return;
        }
        try {
            const sr = 44100;
            const len = sr * 1; // 1 秒
            const off = new OfflineAudioContext(2, len, sr);
            this._addLog('info', `new OfflineAudioContext(2, ${len}, ${sr})：state=${off.state}, sampleRate=${off.sampleRate}`);
            // 离线渲染一段 660Hz 正弦波
            const osc = off.createOscillator();
            const gain = off.createGain();
            osc.connect(gain);
            gain.connect(off.destination);
            osc.frequency.value = 660;
            gain.gain.value = 0.2;
            osc.start(0);
            off.startRendering().then((buf) => {
                this._addLog('info', `OfflineAudioContext.startRendering() ✓ → duration=${buf.duration.toFixed(2)}s, channels=${buf.numberOfChannels}`);
            }).catch((err) => this._addLog('error', `startRendering 失败：${err.message}`));
        }
        catch (err) {
            this._addLog('error', `OfflineAudioContext 异常：${err.message}`);
        }
    }
    // ===================== Card 2: 振荡器 + 增益 + 滤波器 =====================
    _playNote() {
        const ctx = this._ensureCtx();
        if (!ctx)
            return;
        if (typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
            this._addLog('error', 'AudioContext.createOscillator/createGain 不可用（jsdom 不支持音频渲染）');
            return;
        }
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = this._oscType || 'sine';
        osc.frequency.value = this._freq || 440;
        osc.detune.value = 0; // AudioParam：音分微调（detune）
        gain.gain.value = this._gain ?? 0.3;
        filter.type = this._filterType || 'lowpass';
        filter.frequency.value = 1000;
        filter.Q.value = 1;
        filter.gain.value = 0; // lowshelf/highshelf/peaking 用的增益
        // 节点拓扑：source → gain → filter → destination
        osc.connect(gain);
        gain.connect(filter);
        filter.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1);
        this._trackOsc(osc);
        this._track(gain);
        this._track(filter);
        // 1 秒后自动断开
        setTimeout(() => {
            try {
                osc.disconnect();
                gain.disconnect();
                filter.disconnect();
            }
            catch { /* noop */ }
        }, 1100);
        this._addLog('audio', `播放音符：${osc.type} ${osc.frequency.value}Hz · gain=${Math.round(gain.gain.value * 100)}% · filter=${filter.type}@${filter.frequency.value}Hz`);
    }
    // ===================== Card 3: AudioParam 自动化 + AnalyserNode 频谱 =====================
    _playAutomation() {
        const ctx = this._ensureCtx();
        if (!ctx)
            return;
        if (typeof ctx.createOscillator !== 'function' || typeof ctx.createAnalyser !== 'function') {
            this._addLog('error', 'AudioContext.createOscillator/createAnalyser 不可用（jsdom 不支持音频渲染）');
            return;
        }
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        osc.type = 'sawtooth';
        osc.frequency.value = 220;
        osc.connect(gain);
        gain.connect(analyser);
        analyser.connect(ctx.destination);
        // —— ADSR 包络：演示 setValueAtTime / linearRampToValueAtTime / exponentialRampToValueAtTime ——
        const peak = 0.4;
        const sustain = 0.15;
        const attack = 0.05; // 线性爬升
        const decay = 0.25; // 指数下降到 sustain
        const sustainEnd = 1.2; // sustain 持续到 1.2s
        const release = 0.6; // 指数释放到接近 0
        gain.gain.setValueAtTime(0.0001, now); // 起点必须 > 0（exponential 不能从 0）
        gain.gain.linearRampToValueAtTime(peak, now + attack); // 线性 Attack
        gain.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), now + attack + decay); // 指数 Decay
        gain.gain.setValueAtTime(Math.max(sustain, 0.0001), now + sustainEnd); // 保持 Sustain
        gain.gain.exponentialRampToValueAtTime(0.0001, now + sustainEnd + release); // 指数 Release
        // 演示 setTargetAtTime：在 detune 上做指数渐近（缓慢漂移）
        osc.detune.setTargetAtTime(50, now, 0.5);
        // 演示 setValueCurveAtTime：在 detune 上叠加一段颤音曲线（Float32Array）
        const vib = new Float32Array([0, 30, -30, 30, -15, 0]);
        osc.detune.setValueCurveAtTime(vib, now + 0.4, 0.4);
        // 演示 cancelScheduledValues：在结束时取消后续调度（此处仅展示 API 调用）
        gain.gain.cancelScheduledValues(now + sustainEnd + release + 0.01);
        osc.start(now);
        osc.stop(now + sustainEnd + release + 0.05);
        this._trackOsc(osc);
        this._track(gain);
        this._track(analyser);
        this._analyser = analyser;
        this._startSpectrum();
        this.setState({
            autoPlaying: true,
            fftSize: analyser.fftSize,
            frequencyBinCount: analyser.frequencyBinCount,
        });
        this._addLog('audio', `ADSR 自动化：attack(${attack}s linear) · decay(${decay}s exp) · sustain(${sustain}) · release(${release}s exp) | fftSize=${analyser.fftSize}`);
        const totalMs = (sustainEnd + release + 0.15) * 1000;
        this._autoTimer = setTimeout(() => {
            try {
                osc.stop();
            }
            catch { /* noop */ }
            try {
                osc.disconnect();
                gain.disconnect();
                analyser.disconnect();
            }
            catch { /* noop */ }
            this._stopSpectrum();
            this.setState({ autoPlaying: false });
            this._addLog('info', 'ADSR 自动化播放结束，频谱绘制已停止');
        }, totalMs);
    }
    _startSpectrum() {
        this._stopSpectrum();
        const draw = () => {
            const canvas = this.$('.analyser-canvas');
            if (!canvas || !canvas.isConnected || !this._analyser) {
                this._analyserRaf = null;
                return;
            }
            const ctx2d = canvas.getContext('2d');
            if (!ctx2d)
                return;
            const bins = this._analyser.frequencyBinCount;
            const data = new Uint8Array(bins);
            this._analyser.getByteFrequencyData(data); // 频域
            ctx2d.clearRect(0, 0, canvas.width, canvas.height);
            const barW = canvas.width / bins;
            for (let i = 0; i < bins; i++) {
                const v = data[i] / 255;
                const bh = v * canvas.height;
                ctx2d.fillStyle = `hsl(${(i / bins) * 270}, 80%, ${30 + v * 40}%)`;
                ctx2d.fillRect(i * barW, canvas.height - bh, Math.max(barW - 1, 1), bh);
            }
            this._analyserRaf = requestAnimationFrame(draw);
        };
        this._analyserRaf = requestAnimationFrame(draw);
    }
    _stopSpectrum() {
        if (this._analyserRaf) {
            cancelAnimationFrame(this._analyserRaf);
            this._analyserRaf = null;
        }
    }
    // ===================== Card 4: AudioWorklet + decodeAudioData =====================
    async _initWorklet() {
        const ctx = this._ensureCtx();
        if (!ctx)
            return;
        if (typeof ctx.audioWorklet === 'undefined') {
            this.setState({ workletSupported: false });
            this._addLog('error', 'AudioWorklet 不可用（audioContext.audioWorklet === undefined）');
            return;
        }
        this.setState({ workletSupported: true });
        if (this._workletAdded) {
            this._addLog('info', 'AudioWorklet 模块已加载（gain-processor）');
            return;
        }
        try {
            // 用 Blob URL 内联 AudioWorkletProcessor 脚本
            const blob = new Blob([WORKLET_SRC], { type: 'application/javascript' });
            this._workletUrl = URL.createObjectURL(blob);
            await ctx.audioWorklet.addModule(this._workletUrl);
            this._workletAdded = true;
            // 创建 AudioWorkletNode 并读取 parameters 端口
            const node = new AudioWorkletNode(ctx, 'gain-processor');
            const gainParam = node.parameters.get('gain');
            if (gainParam)
                gainParam.value = 0.5;
            this.setState({ workletResult: 'addModule ✓ | AudioWorkletNode ✓ | parameters.get("gain")=0.5' });
            this._addLog('audio', 'audioWorklet.addModule(Blob URL) ✓ + new AudioWorkletNode("gain-processor") ✓');
            // 用一段 330Hz 振荡器测试 worklet 通路
            const osc = ctx.createOscillator();
            osc.frequency.value = 330;
            osc.connect(node);
            node.connect(ctx.destination);
            osc.start();
            this._trackOsc(osc);
            this._track(node);
            setTimeout(() => {
                try {
                    osc.stop();
                }
                catch { /* noop */ }
                try {
                    node.disconnect();
                }
                catch { /* noop */ }
            }, 500);
            this._addLog('info', 'AudioWorkletNode 通路测试：330Hz → gain-processor → destination（0.5s）');
        }
        catch (err) {
            this._addLog('error', `AudioWorklet 失败：${err.message}`);
        }
    }
    async _decodeAudio() {
        const ctx = this._ensureCtx();
        if (!ctx)
            return;
        try {
            const wavBuf = generateSineWav(44100, 0.5, 440);
            this._addLog('info', `decodeAudioData：已生成 ${wavBuf.byteLength} 字节 WAV（440Hz, 0.5s, mono 16-bit）`);
            const audioBuf = await ctx.decodeAudioData(wavBuf);
            const ch0 = audioBuf.getChannelData(0);
            const peak = ch0.length ? Math.max(...ch0.slice(0, 1000)) : 0;
            this.setState({
                decodeResult: [
                    `numberOfChannels = ${audioBuf.numberOfChannels}`,
                    `length = ${audioBuf.length}`,
                    `sampleRate = ${audioBuf.sampleRate} Hz`,
                    `duration = ${audioBuf.duration.toFixed(3)} s`,
                    `getChannelData(0)[0..1000] peak = ${peak.toFixed(3)}`,
                ].join('\n'),
            });
            this._addLog('audio', `decodeAudioData ✓ → channels=${audioBuf.numberOfChannels}, length=${audioBuf.length}, duration=${audioBuf.duration.toFixed(3)}s`);
        }
        catch (err) {
            this._addLog('error', `decodeAudioData 失败：${err.message}`);
        }
    }
    // ===================== Card 5: Web Speech API - SpeechRecognition =====================
    _detectSpeech() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const supported = typeof SR === 'function';
        this.setState({
            speechSupported: supported,
            logs: [...this.state.logs, {
                    type: 'speech',
                    content: supported
                        ? `SpeechRecognition 可用（${window.SpeechRecognition ? 'SpeechRecognition' : 'webkitSpeechRecognition'}）`
                        : 'SpeechRecognition 不可用（typeof SpeechRecognition === "undefined"）',
                    time: formatTime(),
                }].slice(-40),
        });
    }
    _toggleRecognition() {
        if (this.state.speechRunning) {
            this._stopRecognition();
        }
        else {
            this._startRecognition();
        }
    }
    _startRecognition() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (typeof SR !== 'function') {
            this._addLog('error', '当前环境不支持 SpeechRecognition，无法启动识别');
            return;
        }
        if (this._recognition) {
            this._addLog('info', '识别会话已在运行');
            return;
        }
        const rec = new SR();
        rec.lang = 'zh-CN';
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 3;
        rec.onaudiostart = () => this._addLog('speech', 'audiostart：音频采集已开始');
        rec.onspeechstart = () => this._addLog('speech', 'speechstart：检测到语音输入');
        rec.onspeechend = () => this._addLog('speech', 'speechend：语音输入结束');
        rec.onerror = (e) => this._addLog('error', `SpeechRecognition error：${e.error}${e.message ? ' / ' + e.message : ''}`);
        rec.onend = () => {
            this._addLog('speech', 'end：识别会话已结束');
            this.setState({ speechRunning: false });
            this._recognition = null;
        };
        rec.onresult = (e) => {
            const results = e.results;
            const last = results[results.length - 1];
            const alts = [];
            for (let i = 0; i < last.length; i++) {
                alts.push({
                    transcript: last[i].transcript,
                    confidence: last[i].confidence,
                    isFinal: last.isFinal,
                });
            }
            this.setState({ speechResults: [...this.state.speechResults, ...alts].slice(-6) });
            const top = alts[0];
            this._addLog('speech', `result[${last.isFinal ? 'final' : 'interim'}]：${top.transcript}（置信度 ${(top.confidence ?? 0).toFixed(2)}）`);
        };
        try {
            rec.start();
            this._recognition = rec;
            this.setState({ speechRunning: true });
            this._addLog('speech', 'SpeechRecognition.start()（lang=zh-CN, continuous=true, interimResults=true, maxAlternatives=3）');
        }
        catch (err) {
            this._addLog('error', `start 失败：${err.message}`);
        }
    }
    _stopRecognition() {
        if (!this._recognition) {
            this._addLog('error', 'SpeechRecognition 未在运行');
            return;
        }
        try {
            this._recognition.stop();
            this._addLog('speech', 'SpeechRecognition.stop()');
        }
        catch (err) {
            this._addLog('error', `stop 失败：${err.message}`);
        }
    }
    _abortRecognition() {
        if (!this._recognition) {
            this._addLog('error', 'SpeechRecognition 未在运行');
            return;
        }
        try {
            this._recognition.abort();
            this._addLog('speech', 'SpeechRecognition.abort()：立即终止');
        }
        catch (err) {
            this._addLog('error', `abort 失败：${err.message}`);
        }
    }
    // ===================== 日志面板 =====================
    _renderLogPanel() {
        const s = this.state;
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志'), s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // ===================== 渲染 =====================
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'Web Audio API 深入 + 语音识别实验室'),
            h(Alert, {
                type: 'info',
                message: 'AudioContext · OscillatorNode · BiquadFilterNode · AudioParam 自动化 · AnalyserNode · AudioWorklet · decodeAudioData · SpeechRecognition',
                description: 'Web Audio API 全链路 + Web Speech API 语音识别综合演示。AudioContext 必须在用户手势内创建/恢复；SpeechRecognition 需要 HTTPS 与麦克风授权。jsdom 环境下仅展示能力检测与调用流程，所有调用前均做 typeof / in 检测，不可用时记日志说明。',
            }),
            // ============ Card 1: AudioContext 与节点拓扑 ============
            h(Card, {
                title: '1. AudioContext 与节点拓扑',
                extra: h(Tag, { color: s.audioSupported === null ? 'default' : (s.audioSupported ? 'success' : 'error') }, s.audioSupported === null ? '检测中' : (s.audioSupported ? '稳定' : '不可用')),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'new AudioContext() 创建实时音频上下文；new OfflineAudioContext(numberOfChannels, length, sampleRate) 创建离线渲染上下文。state 为 running / suspended / closed，可通过 resume() / suspend() / close() 切换。destination 为最终输出节点。'), h('div', { class: 'flex gap-sm flex-wrap' }, this._btn('创建 AudioContext', { type: 'primary', size: 'sm', onClick: () => this._createCtx() }), this._btn('resume', { size: 'sm', onClick: () => this._resumeCtx() }), this._btn('suspend', { size: 'sm', onClick: () => this._suspendCtx() }), this._btn('close', { size: 'sm', danger: true, onClick: () => this._closeCtx() }), this._btn('OfflineAudioContext', { size: 'sm', onClick: () => this._createOfflineCtx() })), h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm' }, '当前状态：'), h(Tag, { color: s.audioState === 'running' ? 'success' : (s.audioState === 'closed' ? 'error' : 'warning') }, s.audioState)), s.audioCtxInfo && h('pre', { class: 'code-block' }, s.audioCtxInfo), 
            // 节点拓扑图：Source → Effect → Destination
            h('div', { class: 'fs-sm text-secondary mt-xs' }, '节点拓扑（Source → Effect → Destination）：'), h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px', background: 'var(--color-fill, #f5f5f5)', borderRadius: '6px' } }, h('span', { style: { padding: '4px 10px', background: '#1677ff', color: '#fff', borderRadius: '4px', fontSize: '12px' } }, 'OscillatorNode'), h('span', { style: { fontSize: '14px', color: '#999' } }, '→'), h('span', { style: { padding: '4px 10px', background: '#52c41a', color: '#fff', borderRadius: '4px', fontSize: '12px' } }, 'GainNode'), h('span', { style: { fontSize: '14px', color: '#999' } }, '→'), h('span', { style: { padding: '4px 10px', background: '#722ed1', color: '#fff', borderRadius: '4px', fontSize: '12px' } }, 'BiquadFilterNode'), h('span', { style: { fontSize: '14px', color: '#999' } }, '→'), h('span', { style: { padding: '4px 10px', background: '#fa541c', color: '#fff', borderRadius: '4px', fontSize: '12px' } }, 'destination')))),
            // ============ Card 2: 振荡器 + 增益 + 滤波器 ============
            h(Card, {
                title: '2. 振荡器 + 增益 + 滤波器（OscillatorNode / GainNode / BiquadFilterNode）',
                extra: h(Tag, { color: 'success' }, '稳定'),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'OscillatorNode.type（sine/square/sawtooth/triangle/custom）、frequency 与 detune（AudioParam）、start()/stop()。GainNode.gain 控制音量包络。BiquadFilterNode.type 共 8 种滤波器，含 frequency / Q / gain 参数。节点连接：source.connect(gain).connect(filter).connect(destination)。'), 
            // 频率滑块
            h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm', style: { width: '72px' } }, '频率'), h('input', { class: 'freq-slider', type: 'range', min: 80, max: 2000, step: 1, style: { flex: 1 } }), h('span', { class: 'freq-val fs-sm fw-medium', style: { minWidth: '80px' } }, `${this._freq ?? 440} Hz`)), 
            // 音量滑块
            h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm', style: { width: '72px' } }, '音量'), h('input', { class: 'gain-slider', type: 'range', min: 0, max: 1, step: 0.01, style: { flex: 1 } }), h('span', { class: 'gain-val fs-sm fw-medium', style: { minWidth: '80px' } }, `${Math.round((this._gain ?? 0.3) * 100)}%`)), 
            // 振荡器类型
            h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm', style: { width: '72px' } }, '波形'), h('select', { class: 'osc-select', style: { flex: 1 } }, ...OSC_TYPES.map((t) => h('option', { value: t }, t)))), 
            // 滤波器类型
            h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm', style: { width: '72px' } }, '滤波器'), h('select', { class: 'filter-select', style: { flex: 1 } }, ...FILTER_TYPES.map((t) => h('option', { value: t }, t)))), h('div', { class: 'flex gap-sm flex-wrap' }, this._btn('播放音符（1秒）', { type: 'primary', size: 'sm', onClick: () => this._playNote() })), h('p', { class: 'fs-sm text-tertiary' }, 'OscillatorNode → GainNode → BiquadFilterNode → destination。播放 1 秒后自动 stop。'))),
            // ============ Card 3: AudioParam 自动化 + AnalyserNode 频谱 ============
            h(Card, {
                title: '3. AudioParam 自动化 + AnalyserNode 频谱',
                extra: h(Tag, { color: s.autoPlaying ? 'success' : 'default' }, s.autoPlaying ? '播放中' : '已停止'),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'AudioParam 自动化：setValueAtTime / linearRampToValueAtTime（线性）/ exponentialRampToValueAtTime（指数，不能从 0）/ setTargetAtTime（指数渐近）/ setValueCurveAtTime（曲线）/ cancelScheduledValues。AnalyserNode：fftSize（2 的幂，32-32768）、frequencyBinCount=fftSize/2、getByteFrequencyData（频域）/ getByteTimeDomainData（时域）、smoothingTimeConstant。'), h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn(s.autoPlaying ? '播放中…' : '播放 ADSR 自动化', {
                type: 'primary', size: 'sm', onClick: () => this._playAutomation(), disabled: s.autoPlaying,
            }), h('span', { class: 'fs-sm text-secondary' }, 'fftSize：'), h(Tag, { color: 'primary' }, String(s.fftSize || '—')), h('span', { class: 'fs-sm text-secondary' }, 'frequencyBinCount：'), h(Tag, { color: 'primary' }, String(s.frequencyBinCount || '—'))), h('canvas', { class: 'analyser-canvas', width: 600, height: 140, style: { width: '100%', height: '140px', background: '#0d1117', borderRadius: '6px' } }), h('p', { class: 'fs-sm text-tertiary' }, 'sawtooth 220Hz → GainNode(ADSR) → AnalyserNode → destination。canvas 用 requestAnimationFrame + getByteFrequencyData 实时绘制频谱条形图。'))),
            // ============ Card 4: AudioWorklet + decodeAudioData ============
            h(Card, {
                title: '4. AudioWorklet 与解码（AudioWorkletNode / decodeAudioData）',
                extra: h(Tag, { color: s.workletSupported === null ? 'default' : (s.workletSupported ? 'success' : 'error') }, s.workletSupported === null ? '检测中' : (s.workletSupported ? '实验性' : '不可用')),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'AudioWorklet：audioContext.audioWorklet.addModule(url) 注册 AudioWorkletProcessor，new AudioWorkletNode(ctx, name) 创建节点，parameters 为参数端口。decodeAudioData(arrayBuffer) → Promise<AudioBuffer>，AudioBuffer 含 numberOfChannels / length / sampleRate / duration / getChannelData(channel)。'), h('div', { class: 'flex gap-sm flex-wrap' }, this._btn('加载 AudioWorklet', { type: 'primary', size: 'sm', onClick: () => this._initWorklet() }), this._btn('decodeAudioData', { size: 'sm', onClick: () => this._decodeAudio() })), s.workletResult && h('div', { class: 'fs-sm' }, h('strong', {}, 'AudioWorklet：'), h('span', { class: 'text-secondary' }, s.workletResult)), s.decodeResult && h('div', {}, h('div', { class: 'fs-sm text-secondary mb-xs' }, 'decodeAudioData 返回的 AudioBuffer：'), h('pre', { class: 'code-block' }, s.decodeResult)), h('div', { class: 'fs-sm text-secondary mt-xs' }, 'AudioWorklet Processor 源码（通过 Blob URL 内联，addModule 加载）：'), h('pre', { class: 'code-block' }, WORKLET_SRC.trim()))),
            // ============ Card 5: Web Speech API - SpeechRecognition ============
            h(Card, {
                title: '5. Web Speech API - SpeechRecognition（语音识别）',
                extra: h(Tag, { color: s.speechSupported === null ? 'default' : (s.speechSupported ? 'warning' : 'error') }, s.speechSupported === null ? '检测中' : (s.speechSupported ? '实验性' : '不可用')),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'SpeechRecognition（webkitSpeechRecognition 前缀）：continuous / interimResults / lang / maxAlternatives 属性，start()/stop()/abort() 方法，audiostart / speechstart / speechend / result / error / end 事件。SpeechRecognitionResult 含 SpeechRecognitionAlternative（transcript / confidence）。SpeechGrammarList 可选。能力检测：\'SpeechRecognition\' in window || \'webkitSpeechRecognition\' in window。'), h('div', { class: 'flex gap-sm flex-wrap' }, this._btn(s.speechRunning ? '停止识别' : '开始识别', {
                type: s.speechRunning ? 'danger' : 'primary', size: 'sm',
                onClick: () => this._toggleRecognition(),
                disabled: s.speechSupported === false,
            }), this._btn('abort', { size: 'sm', onClick: () => this._abortRecognition(), disabled: !s.speechRunning })), h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm' }, '识别状态：'), h(Tag, { color: s.speechRunning ? 'success' : 'default' }, s.speechRunning ? '运行中' : '已停止'), h('span', { class: 'fs-sm text-tertiary' }, 'lang=zh-CN, interimResults=true, maxAlternatives=3')), s.speechResults.length > 0
                ? h('div', { class: 'log-panel' }, ...s.speechResults.map((r) => h('div', { class: 'log-panel__line' }, h('span', { class: `log-panel__tag log-panel__tag--${r.isFinal ? 'speech' : 'info'}` }, r.isFinal ? 'final' : 'interim'), h('span', { class: 'log-panel__content' }, `${r.transcript}（${(r.confidence ?? 0).toFixed(2)}）`))))
                : h('div', { class: 'log-panel__empty' }, '（暂无识别结果）'))),
            // ============ 日志面板 ============
            h(Card, {
                title: '事件日志',
                extra: h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
            }, this._renderLogPanel()),
        ];
    }
}
//# sourceMappingURL=AdvancedWebAudioPage.js.map