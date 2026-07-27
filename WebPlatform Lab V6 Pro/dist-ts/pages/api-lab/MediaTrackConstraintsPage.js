// =====================================================================
// MediaTrackConstraintsPage.js —— MediaTrackConstraints 深度实验室
// 演示 MDN：
//   1. MediaTrackConstraints 约束模型 —— ideal/exact/min/max 四种约束形式，
//      getUserMedia({ audio: { echoCancellation: { ideal: true } } })
//   2. echoCancellation 回声消除 —— AEC 算法、通话场景必备、关闭后裸音频对比
//   3. noiseSuppression 降噪 —— NS 算法、RNNoise 神经网络降噪、录音场景关闭
//   4. autoGainControl 自动增益 —— AGC、音乐录制场景关闭、与 WebCodecs 协同
//   5. channelCount/sampleRate/sampleSize —— 声道/采样率/位深约束与实际值差异
//   6. latency 与 voiceIsolation —— 低延迟直播、Chrome 126+ AI 人声隔离
//   7. applyConstraints 动态切换 —— 运行时切换约束无需重新 getUserMedia
//   8. 实战与陷阱 —— WebRTC 调优矩阵、录音 vs 通话差异化、降级方案
// 协同 API：MediaStreamTrack.getCapabilities() / getSettings() / applyConstraints()
//           track.onoverconstrained 事件、MediaDevices.getSupportedConstraints()
// 说明：navigator.mediaDevices.getUserMedia / MediaStreamTrack.prototype.getCapabilities
//       在 jsdom 中均 undefined，所有 API 调用前做 typeof 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。本页不真正调用 getUserMedia（会触发权限弹窗），
//       仅展示约束模型用法与能力检测。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
// MediaTrackConstraints 支持的全部音频约束键（按 MDN 文档罗列）
const ALL_AUDIO_CONSTRAINT_KEYS = [
    'echoCancellation', 'noiseSuppression', 'autoGainControl',
    'channelCount', 'sampleRate', 'sampleSize',
    'latency', 'voiceIsolation', 'volume',
    'deviceId', 'groupId',
];
export class MediaTrackConstraintsPage extends Page {
    _dynamicStyles;
    _inited;
    _micStream;
    _micTrack;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            // Card 1：MediaTrackConstraints 概述与约束模型
            overviewInfo: '',
            // Card 2：echoCancellation 回声消除
            aecInfo: '',
            // Card 3：noiseSuppression 降噪
            nsInfo: '',
            // Card 4：autoGainControl 自动增益
            agcInfo: '',
            // Card 5：channelCount/sampleRate/sampleSize
            channelInfo: '',
            // Card 6：latency 与 voiceIsolation
            latencyInfo: '',
            // Card 7：applyConstraints 动态切换
            applyInfo: '',
            // Card 8：实战模式与陷阱
            patternInfo: '',
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._micStream = null; // getUserMedia 创建的麦克风 MediaStream（演示用）
        this._micTrack = null; // 麦克风音频 track（演示 capabilities/settings/applyConstraints）
        this._dynamicStyles = []; // 动态注入的 <style> 节点
        // 一次性能力检测：getUserMedia / getCapabilities / applyConstraints / onoverconstrained
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `getUserMedia ${c(f.userMedia)}`,
            `getCapabilities ${c(f.getCapabilities)}`,
            `getSettings ${c(f.getSettings)}`,
            `applyConstraints ${c(f.applyConstraints)}`,
            `onoverconstrained ${c(f.onoverconstrained)}`,
            `getSupportedConstraints ${c(f.supportedConstraints)}`,
            `MediaStreamTrack ${c(f.mediaStreamTrack)}`,
        ];
        const any = f.userMedia || f.getCapabilities || f.applyConstraints;
        const summary = any
            ? `能力检测：${parts.join(' · ')}。当前环境部分能力可用；getUserMedia 会触发麦克风权限弹窗，本页不真正调用，仅展示约束模型与能力检测。`
            : `能力检测：${parts.join('，')}。当前环境（jsdom/Node）navigator.mediaDevices 与 MediaStreamTrack 均不可用；所有按钮点击仅记日志说明，不会抛异常。在真实浏览器（HTTPS 或 localhost）中打开可完整演示。`;
        this.setState({ capsSummary: summary });
        this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.userMedia)
            this._addLog('warn', 'navigator.mediaDevices.getUserMedia 不可用（需安全上下文 https/localhost + 真实浏览器）');
        if (!f.getCapabilities)
            this._addLog('warn', 'MediaStreamTrack.prototype.getCapabilities 不可用（需 Chromium 系浏览器）');
        if (!f.applyConstraints)
            this._addLog('warn', 'MediaStreamTrack.prototype.applyConstraints 不可用');
        if (!f.onoverconstrained)
            this._addLog('warn', 'track.onoverconstrained 不可用（部分浏览器仅支持 overconstrained 事件 addEventListener）');
        if (f.userMedia)
            this._addLog('info', 'getUserMedia 可用，但本页不真正调用（避免触发权限弹窗）');
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        // 释放麦克风 MediaStream 的所有 track，移除动态注入的 <style> 节点，置空引用便于 GC
        this._stopMicStream();
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
    }
    // —— 日志 / 按钮 / 能力辅助 ——
    _addLog(type, content) {
        this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    // 渲染能力 Tag 数组：items = [[label, ok], ...]
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    // 布尔能力检测标志（render 与 componentDidMount 共用，开销可忽略）
    _flags() {
        const safe = (fn) => {
            try {
                return fn();
            }
            catch {
                return false;
            }
        };
        const hasMedia = safe(() => typeof navigator !== 'undefined' && navigator.mediaDevices &&
            typeof navigator.mediaDevices === 'object');
        const md = safe(() => navigator.mediaDevices);
        const proto = safe(() => MediaStreamTrack && MediaStreamTrack.prototype);
        return {
            mediaDevices: hasMedia,
            userMedia: hasMedia && safe(() => typeof md.getUserMedia === 'function'),
            supportedConstraints: hasMedia && safe(() => typeof md.getSupportedConstraints === 'function'),
            mediaStreamTrack: !!proto,
            getCapabilities: !!proto && safe(() => typeof proto.getCapabilities === 'function'),
            getSettings: !!proto && safe(() => typeof proto.getSettings === 'function'),
            applyConstraints: !!proto && safe(() => typeof proto.applyConstraints === 'function'),
            onoverconstrained: !!proto && safe(() => 'onoverconstrained' in proto),
            stop: !!proto && safe(() => typeof proto.stop === 'function'),
            clone: !!proto && safe(() => typeof proto.clone === 'function'),
        };
    }
    _injectStyle(id, css) {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function')
            return;
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
    }
    _injectBaseStyles() {
        this._injectStyle('mtc-base', `
      .mtc-demo {
        padding: 14px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .mtc-matrix {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .mtc-matrix-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
      }
      .mtc-matrix-cell--head {
        background: #1e293b;
        color: #fff;
        font-weight: 600;
      }
      .mtc-constraint-row {
        display: grid;
        grid-template-columns: 200px 100px 100px 100px 1fr;
        gap: 6px;
        padding: 6px 8px;
        font-size: 12px;
        border-bottom: 1px solid #f1f5f9;
        align-items: center;
      }
      .mtc-constraint-row--head {
        background: #334155;
        color: #fff;
        font-weight: 600;
        border-radius: 4px 4px 0 0;
      }
      .mtc-pill {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 600;
      }
      .mtc-pill--yes { background: #dcfce7; color: #166534; }
      .mtc-pill--no { background: #fee2e2; color: #991b1b; }
      .mtc-pill--partial { background: #fef3c7; color: #92400e; }
      .mtc-pill--na { background: #e2e8f0; color: #475569; }
      .mtc-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    }
    // —— 内部辅助：停止麦克风 MediaStream ——
    _stopMicStream() {
        if (this._micStream) {
            try {
                this._micStream.getTracks().forEach((t) => t.stop());
            }
            catch { /* noop */ }
            this._micStream = null;
            this._micTrack = null;
        }
        else if (this._micTrack) {
            try {
                this._micTrack.stop();
            }
            catch { /* noop */ }
            this._micTrack = null;
        }
    }
    // =================== Card 1：MediaTrackConstraints 概述与约束模型 ===================
    _runOverviewDemo() {
        const f = this._flags();
        let supported = {};
        if (f.supportedConstraints) {
            try {
                supported = navigator.mediaDevices.getSupportedConstraints();
            }
            catch (err) {
                this._addLog('warn', `getSupportedConstraints 失败：${err.name} - ${err.message}`);
            }
        }
        const supportedKeys = ALL_AUDIO_CONSTRAINT_KEYS.filter((k) => (supported[k]));
        const unsupportedKeys = ALL_AUDIO_CONSTRAINT_KEYS.filter((k) => !(supported[k]));
        this._injectStyle('mtc-overview-demo', `
      .mtc-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        const info = [
            '===== MediaTrackConstraints 概述与约束模型 =====',
            '',
            '【什么是 MediaTrackConstraints】',
            '  - MediaTrackConstraints 是 MediaStreamConstraints 的子约束对象，',
            '    用于描述 getUserMedia({ audio: {...}, video: {...} }) 中对单条 track 的要求',
            '  - 与 MediaTrackSettings / MediaTrackCapabilities 三者协同：',
            '    • Constraints：开发者「期望」（ideal）/「强制」（exact）的约束',
            '    • Capabilities：设备「能力」上/下限（getCapabilities 返回 min/max 范围）',
            '    • Settings：浏览器「实际选中」的值（getSettings 返回具体数值）',
            '  - 三者关系：Constraints 是输入，Settings 是输出，Capabilities 是边界',
            '',
            '【四种约束形式】',
            '  1. ideal（首选）：浏览器尽量满足，无法满足时降级到最接近值',
            '     echoCancellation: { ideal: true }',
            '  2. exact（强制）：必须满足，否则 getUserMedia 抛 OverconstrainedError',
            '     sampleRate: { exact: 48000 }',
            '  3. min（最小值）：数值型约束，实际值 >= min',
            '     channelCount: { min: 2 }',
            '  4. max（最大值）：数值型约束，实际值 <= max',
            '     latency: { max: 0.02 }',
            '',
            '【简写形式等价于 ideal】',
            '  echoCancellation: true  ≡  echoCancellation: { ideal: true }',
            '  channelCount: 2         ≡  channelCount: { ideal: 2 }',
            '  布尔型约束（echoCancellation/noiseSuppression/autoGainControl/voiceIsolation）',
            '  只支持 ideal/exact（即 true/false），不支持 min/max',
            '',
            '【核心 API 协同】',
            "  // 1. getUserMedia 传入 Constraints（输入）",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: {",
            "      echoCancellation: { ideal: true },",
            "      noiseSuppression: { ideal: true },",
            "      autoGainControl: { ideal: false },",
            "      channelCount: { ideal: 1 },",
            "      sampleRate: { ideal: 48000 },",
            "      voiceIsolation: { ideal: true },",
            "    },",
            "  });",
            "  const track = stream.getAudioTracks()[0];",
            '',
            "  // 2. getCapabilities 读取设备能力边界（min/max）",
            "  const caps = track.getCapabilities();",
            "  // { echoCancellation: [true, false], channelCount: { min:1, max:2 }, ... }",
            '',
            "  // 3. getSettings 读取浏览器实际选中的值",
            "  const settings = track.getSettings();",
            "  // { echoCancellation: true, channelCount: 1, sampleRate: 48000, ... }",
            '',
            "  // 4. applyConstraints 运行时修改约束（无需重新 getUserMedia）",
            "  await track.applyConstraints({ echoCancellation: false });",
            '',
            "  // 5. onoverconstrained 监听约束无法满足（部分浏览器）",
            "  track.onoverconstrained = (e: any) => console.warn('overconstrained', e);",
            '',
            '【getSupportedConstraints 全局能力检测】',
            '  navigator.mediaDevices.getSupportedConstraints() → object',
            '  返回当前浏览器支持的约束键（值为 true），不依赖具体设备',
            '  用于在 getUserMedia 前判断某约束是否被浏览器识别',
            '',
            `【当前环境 getSupportedConstraints() 结果】`,
            `  typeof navigator.mediaDevices.getSupportedConstraints = "${f.supportedConstraints ? 'function' : 'undefined'}"`,
            `  支持的约束键（${supportedKeys.length} 项）：${supportedKeys.join(', ') || '（空或不可用）'}`,
            `  未支持约束键（${unsupportedKeys.length} 项）：${unsupportedKeys.join(', ') || '（无）'}`,
            '',
            '【浏览器支持矩阵】',
            '  浏览器           getUserMedia  getCapabilities  applyConstraints  voiceIsolation',
            '  Chrome 126+      ✓             ✓                ✓                 ✓ AI 人声隔离',
            '  Edge 126+        ✓             ✓                ✓                 ✓',
            '  Safari 14+       ✓             ✓ 部分           ✓ 部分            ✗ 不支持',
            '  Firefox          ✓             ✗ 不支持         ✓                 ✗ 不支持',
            '  移动端 Chrome    ✓             ✓                ✓                 ✓',
            '  移动端 Safari    ✓             ✓ 部分           ✓ 部分            ✗',
            '',
            '【安全上下文要求】',
            '  - 必须 HTTPS 或 localhost（含 127.0.0.1）',
            '  - http:// 非 localhost 会被 navigator.mediaDevices === undefined 拒绝',
            '  - 检测：window.isSecureContext 返回 true',
            '',
            '【常见陷阱】',
            '  1. exact 约束过严会抛 OverconstrainedError，建议优先用 ideal',
            '  2. getCapabilities 在 Firefox 完全不支持，需能力检测降级',
            '  3. getSettings 返回的实际值可能与约束值不同（设备不支持时降级）',
            '  4. voiceIsolation 仅 Chrome 126+ 支持，Safari/Firefox 完全不支持',
            '  5. 移动端默认值与桌面端差异大（如 channelCount 默认 1）',
        ].join('\n');
        this.setState({ overviewInfo: info });
        this._addLog(f.supportedConstraints ? 'info' : 'warn', `getSupportedConstraints ${f.supportedConstraints ? '返回 ' + supportedKeys.length + ' 项' : '不可用'}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. MediaTrackConstraints 概述与约束模型（ideal/exact/min/max）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['getUserMedia', f.userMedia],
                ['getCapabilities', f.getCapabilities],
                ['applyConstraints', f.applyConstraints],
            ])),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'MediaTrackConstraints 是 getUserMedia({ audio: {...} }) 中对单条 track 的约束对象，与 MediaTrackCapabilities（设备能力，getCapabilities 返回 min/max）和 MediaTrackSettings（实际选中值，getSettings 返回）三者协同。约束模型支持 ideal（首选，无法满足时降级）/ exact（强制，不满足抛 OverconstrainedError）/ min/max（数值型边界）四种形式。布尔型约束（echoCancellation/noiseSuppression/autoGainControl/voiceIsolation）仅支持 ideal/exact。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('检测能力 + getSupportedConstraints', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }), this._btn('查看约束模型说明', { size: 'sm', onClick: () => this._runOverviewDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '约束模型与能力检测：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击「检测能力 + getSupportedConstraints」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, `// ideal vs exact 区别
const streamA = await navigator.mediaDevices.getUserMedia({
  audio: { sampleRate: { ideal: 48000 } }  // 尽量满足，不行降级
});
const streamB = await navigator.mediaDevices.getUserMedia({
  audio: { sampleRate: { exact: 48000 } }  // 必须满足，否则 OverconstrainedError
});

// getSupportedConstraints 全局能力检测（不依赖设备）
const sc = navigator.mediaDevices.getSupportedConstraints();
if (sc.voiceIsolation) {
  // 浏览器识别 voiceIsolation 约束，可安全传入
} else {
  console.warn('voiceIsolation 不被浏览器支持，将被忽略');
}`)),
                h(Alert, {
                    type: 'info',
                    message: 'Constraints → Settings → Capabilities 三者协同',
                    description: 'Constraints 是开发者输入（ideal/exact/min/max），Capabilities 是设备能力边界（getCapabilities 返回 min/max），Settings 是浏览器实际选中的值（getSettings 返回）。三者关系：Constraints 是输入，Settings 是输出，Capabilities 是边界。getSettings 返回值可能与约束值不同（设备不支持时降级）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：echoCancellation 回声消除 ===================
    _runAecDemo() {
        const f = this._flags();
        let capsEcho = '（getCapabilities 不可用）';
        if (f.getCapabilities) {
            capsEcho = '需在真实浏览器中调用 track.getCapabilities().echoCancellation（返回 [true, false] 表示两端均可选）';
        }
        const info = [
            '===== echoCancellation 回声消除（AEC）=====',
            '',
            '【AEC 算法原理】',
            '  - Acoustic Echo Cancellation，声学回声消除',
            '  - 场景：扬声器播放对方声音 → 麦克风采集到该声音 → 回传给对方形成回声',
            '  - AEC 算法自适应滤波器（NLMS / RLS / Sub-band）建模扬声器→麦克风路径',
            '  - 从麦克风信号中减去估计的回声分量，保留本地人声',
            '  - WebRTC 内置 AEC（Chrome 用 AEC3，基于分区块自适应滤波）',
            '',
            '【通话场景必备】',
            '  - 免提通话：扬声器外放 + 麦克风采集，无 AEC 对方会听到自己回声',
            '  - 视频会议：多端同时发言，AEC 防止回声循环啸叫',
            '  - 默认值：getUserMedia 默认 echoCancellation: true（浏览器自动开启）',
            '  - 关闭后裸音频：本地人声 + 扬声器回声混合，对方体验极差',
            '',
            '【约束用法】',
            "  // ideal 形式（推荐）：尽量开启，设备不支持时降级",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: { echoCancellation: { ideal: true } }",
            "  });",
            "  // 简写等价",
            "  // audio: { echoCancellation: true }",
            '',
            "  // exact 形式：必须开启，否则 OverconstrainedError",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: { echoCancellation: { exact: true } }",
            "  });",
            '',
            "  // 关闭 AEC（录音场景，保留原始声学环境）",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: { echoCancellation: false }",
            "  });",
            '',
            '【能力检测】',
            '  // 1. 全局：浏览器是否识别该约束键',
            '  const sc = navigator.mediaDevices.getSupportedConstraints();',
            '  sc.echoCancellation; // true 表示浏览器识别',
            '',
            '  // 2. 设备：当前设备是否支持 AEC 两端',
            '  const track = stream.getAudioTracks()[0];',
            '  const caps = track.getCapabilities();',
            `  ${capsEcho}`,
            '  // caps.echoCancellation: [true, false] 表示可开可关',
            '  // caps.echoCancellation: [true] 表示仅支持开启',
            '',
            '  // 3. 实际值：浏览器当前是否开启',
            '  const settings = track.getSettings();',
            '  settings.echoCancellation; // true / false',
            '',
            '【关闭 AEC 后裸音频对比】',
            '  场景：用 getUserMedia({ audio: { echoCancellation: false } }) 录制',
            '  - 录制本地人声 + 扬声器播放的对方声音（混合）',
            '  - 在 WebRTC 通话中传给对方，对方会听到自己的回声',
            '  - 对比开启 AEC：对方只听到你的本地人声，无回声',
            '  - 录音场景（不通话）：关闭 AEC 保留原始声学，后期可软件 AEC',
            '',
            '【与 WebRTC echoCancellationType 协同】',
            '  - RTCRtpSender.setParameters({ encodings, transactionId })',
            '    不含 echoCancellation（那是 track 层约束，非 RTP 层参数）',
            '  - WebRTC 层 echoCancellationType: "system" | "browser" 在 SDP 协商',
            '    通过 SDP a=rtcp-fb 或浏览器内部 SDP munging 设置',
            '  - track.getSettings().echoCancellation 反映实际值',
            '',
            '【浏览器支持】',
            '  Chrome/Edge：✓ 全支持，AEC3 算法',
            '  Safari：✓ 支持，系统级 AEC（macOS CoreAudio / iOS Audio Unit）',
            '  Firefox：✓ 支持，WECL AEC',
            '  默认值：true（除非显式关闭）',
            '',
            `【当前环境检测】`,
            `  navigator.mediaDevices.getUserMedia: ${f.userMedia ? '✓' : '✗'}`,
            `  MediaStreamTrack.getCapabilities: ${f.getCapabilities ? '✓' : '✗'}`,
            `  ${!f.userMedia ? 'jsdom 不可用，需真实浏览器' : ''}`,
        ].join('\n');
        this.setState({ aecInfo: info });
        this._addLog(f.userMedia ? 'info' : 'warn', `echoCancellation 演示：getUserMedia ${f.userMedia ? '可用（本页不真正调用）' : '不可用'}`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. echoCancellation 回声消除（AEC）—— 通话场景必备',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: f.userMedia ? 'success' : 'error' }, f.userMedia ? '✓ getUserMedia' : '不可用'), h(Tag, { color: 'primary' }, 'AEC3 / NLMS')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'echoCancellation 控制声学回声消除（AEC）算法开关。扬声器播放对方声音 → 麦克风采集到 → 不消除则对方听到自己回声。WebRTC 内置 AEC3（Chrome，分区块自适应滤波）/ 系统 AEC（Safari，CoreAudio）。默认 true，免提通话必备。关闭后裸音频仅适合本地录音（不通话）。getCapabilities().echoCancellation 返回 [true, false] 表示两端可选。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('AEC 原理与用法', { type: 'primary', size: 'sm', onClick: () => this._runAecDemo() }), this._btn('查看能力检测代码', { size: 'sm', onClick: () => this._runAecDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'echoCancellation 演示：'),
                h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.aecInfo || '（点击「AEC 原理与用法」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } }, h('code', {}, `// 通话场景：开启 AEC
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: { ideal: true } }
});
const track = stream.getAudioTracks()[0];
const caps = track.getCapabilities();
// caps.echoCancellation: [true, false] 表示可开可关
const settings = track.getSettings();
// settings.echoCancellation: true（实际开启）

// 录音场景：关闭 AEC 保留原始声学
const rawStream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: false }
});`)),
                h(Alert, {
                    type: 'warning',
                    message: '免提通话必须开启 AEC',
                    description: '免提通话（扬声器外放 + 麦克风采集）若关闭 AEC，对方会听到自己回声，体验极差。默认 echoCancellation: true。仅在本地录音（不通话）场景可关闭以保留原始声学环境。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：noiseSuppression 降噪 ===================
    _runNsDemo() {
        const f = this._flags();
        const info = [
            '===== noiseSuppression 降噪（NS）=====',
            '',
            '【NS 算法原理】',
            '  - Noise Suppression，噪声抑制',
            '  - 目标：去除稳态/非稳态背景噪声（风扇、空调、键盘、键盘、环境噪声）',
            '  - 传统算法：谱减法 / Wiener 滤波 / MMSE-LSA（最小均方误差对数幅度）',
            '  - WebRTC 内置 NS：基于噪声估计 + 维纳滤波，分前端/后端 NS',
            '  - 浏览器默认 NS 处理：48kHz 16bit 输入，分帧 FFT 估计噪声功率谱',
            '',
            '【RNNoise 神经网络降噪】',
            '  - Mozilla RNNoise：基于 RNN（GRU）的实时降噪',
            '  - 输入：22 个 bark 尺度频带特征',
            '  - 模型：3 层 GRU（214 维隐藏）+ 全连接输出',
            '  - 优势：对非稳态噪声（键盘、咳嗽）抑制效果优于传统谱减',
            '  - Chrome 部分版本集成 RNNoise-like 算法',
            '  - 可通过 WebAssembly + AudioWorklet 自行实现 RNNoise 降噪',
            '',
            '【默认开启】',
            '  - getUserMedia 默认 noiseSuppression: true',
            '  - 通话场景：开启 NS 抑制背景噪声，提升对方听感',
            '  - 录音场景：关闭 NS 保留细节（环境声、乐器泛音、现场感）',
            '',
            '【约束用法】',
            "  // 通话场景：开启 NS（默认）",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: { noiseSuppression: { ideal: true } }",
            "  });",
            '',
            "  // 录音场景：关闭 NS 保留细节",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: {",
            "      noiseSuppression: false,",
            "      echoCancellation: false,    // 录音场景一并关闭",
            "      autoGainControl: false,",
            "    },",
            "  });",
            '',
            '【能力检测】',
            '  const sc = navigator.mediaDevices.getSupportedConstraints();',
            '  sc.noiseSuppression; // true 表示浏览器识别',
            '',
            '  const track = stream.getAudioTracks()[0];',
            '  const caps = track.getCapabilities();',
            '  caps.noiseSuppression; // [true, false] 两端可选',
            '',
            '  const settings = track.getSettings();',
            '  settings.noiseSuppression; // true / false 实际值',
            '',
            '【录音场景关闭 NS 保留细节】',
            '  - 音乐录制：NS 会误判乐器泛音为噪声并抑制，破坏音质',
            '  - 现场采访：环境声（鸟鸣、车流）是内容一部分，不应抑制',
            '  - ASR 训练数据采集：需原始音频含噪声，模型才鲁棒',
            '  - 后期可软件降噪（Audacity / ffmpeg arnndn / RNNoise WASM）',
            '',
            '【RNNoise WASM + AudioWorklet 自实现降噪】',
            '  // 1. 加载 RNNoise WASM 模型（约 200KB）',
            '  const rnnoise = await RNNoise.load();',
            '',
            '  // 2. AudioWorkletProcessor 处理帧',
            '  class RNNoiseProcessor extends AudioWorkletProcessor {',
            '    process(inputs: any, outputs: any){',
            '      const input = inputs[0][0];    // Float32Array 128 帧',
            '      const output = outputs[0][0];',
            '      const denoised = rnnoise.process(input);',
            '      output.set(denoised);',
            '      return true;',
            '    }',
            '  }',
            '',
            '  // 3. 接入音频图：source → rnnoiseNode → destination',
            '  const ctx = new AudioContext();',
            '  const src = ctx.createMediaStreamSource(rawStream);',
            '  await ctx.audioWorklet.addModule("rnnoise-processor.js");',
            '  const node = new AudioWorkletNode(ctx, "rnnoise-processor");',
            '  src.connect(node).connect(ctx.destination);',
            '',
            '【浏览器支持】',
            '  Chrome/Edge：✓ 全支持，WebRTC NS',
            '  Safari：✓ 支持，系统级 NS（macOS CoreAudio）',
            '  Firefox：✓ 支持',
            '  默认值：true',
            '',
            '【常见陷阱】',
            '  1. 音乐录制务必关闭 NS，否则乐器泛音被抑制',
            '  2. NS 会对人声高频部分（齿音）产生 artifacts',
            '  3. 强噪声环境下 NS 可能误判人声为噪声',
            '  4. RNNoise WASM 体积大（200KB），首屏加载需权衡',
            '',
            `【当前环境检测】`,
            `  getUserMedia: ${f.userMedia ? '✓' : '✗'}（${f.userMedia ? '本页不真正调用' : 'jsdom 不可用'}）`,
        ].join('\n');
        this.setState({ nsInfo: info });
        this._addLog(f.userMedia ? 'info' : 'warn', `noiseSuppression 演示：${f.userMedia ? '已展示用法' : 'getUserMedia 不可用'}`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. noiseSuppression 降噪（NS）—— RNNoise 神经网络降噪对比',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: f.userMedia ? 'success' : 'error' }, f.userMedia ? '✓ NS 可用' : '不可用'), h(Tag, { color: 'primary' }, 'RNNoise / Wiener')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'noiseSuppression 控制噪声抑制（NS）算法开关。WebRTC 内置 NS（噪声估计 + 维纳滤波），Mozilla RNNoise 用 RNN（GRU）实时降噪，对非稳态噪声效果更优。默认 true，通话场景抑制背景噪声。录音场景（音乐录制、现场采访、ASR 训练数据）关闭 NS 保留细节，后期可软件降噪（Audacity / RNNoise WASM + AudioWorklet）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('NS 原理与用法', { type: 'primary', size: 'sm', onClick: () => this._runNsDemo() }), this._btn('RNNoise WASM 方案', { size: 'sm', onClick: () => this._runNsDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'noiseSuppression 演示：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.nsInfo || '（点击「NS 原理与用法」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } }, h('code', {}, `// 录音场景：关闭 NS/AGC/AEC 保留原始音频
const rawStream = await navigator.mediaDevices.getUserMedia({
  audio: {
    noiseSuppression: false,
    echoCancellation: false,
    autoGainControl: false,
    channelCount: 2,
    sampleRate: 48000,
  }
});
// 后期可用 RNNoise WASM + AudioWorklet 软件降噪
const track = rawStream.getAudioTracks()[0];
console.log(track.getSettings().noiseSuppression); // false`)),
                h(Alert, {
                    type: 'warning',
                    message: '音乐录制务必关闭 NS',
                    description: 'NS 会将乐器泛音、高频细节误判为噪声并抑制，破坏音质。音乐录制、现场采访、ASR 训练数据采集场景应关闭 NS（及 AGC/AEC）保留原始音频，后期用 Audacity / RNNoise WASM + AudioWorklet 软件降噪。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：autoGainControl 自动增益 ===================
    _runAgcDemo() {
        const f = this._flags();
        const info = [
            '===== autoGainControl 自动增益（AGC）=====',
            '',
            '【AGC 算法原理】',
            '  - Automatic Gain Control，自动增益控制',
            '  - 目标：自动调整输入增益，使输出信号幅度稳定',
            '  - 场景：说话声音忽大忽小 → AGC 自动拉平',
            '  - WebRTC AGC：基于 RMS 估计 + 增益曲线（fixed digital / adaptive digital）',
            '  - 模式：analog（模拟增益，调节麦克风硬件）/ digital（数字增益，软件乘系数）',
            '',
            '【默认开启】',
            '  - getUserMedia 默认 autoGainControl: true',
            '  - 通话场景：开启 AGC 拉平音量，对方听感稳定',
            '  - 音乐录制场景：关闭 AGC，保留原始动态范围（弱音/强音对比）',
            '',
            '【约束用法】',
            "  // 通话场景：开启 AGC（默认）",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: { autoGainControl: { ideal: true } }",
            "  });",
            '',
            "  // 音乐录制场景：关闭 AGC",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: {",
            "      autoGainControl: false,",
            "      noiseSuppression: false,",
            "      echoCancellation: false,",
            "    },",
            "  });",
            '',
            '【能力检测】',
            '  const sc = navigator.mediaDevices.getSupportedConstraints();',
            '  sc.autoGainControl; // true 表示浏览器识别',
            '',
            '  const track = stream.getAudioTracks()[0];',
            '  const caps = track.getCapabilities();',
            '  caps.autoGainControl; // [true, false]',
            '',
            '  const settings = track.getSettings();',
            '  settings.autoGainControl; // true / false',
            '',
            '【与 MediaStreamTrackProcessor + WebCodecs 协同】',
            '  // 关闭 AGC 后用 MediaStreamTrackProcessor 取原始音频帧',
            '  // 配合 WebCodecs AudioEncoder 编码原始 PCM',
            '',
            '  // 1. getUserMedia 关闭所有处理，取原始音频',
            '  const rawStream = await navigator.mediaDevices.getUserMedia({',
            '    audio: {',
            '      autoGainControl: false,',
            '      noiseSuppression: false,',
            '      echoCancellation: false,',
            '      channelCount: 2,',
            '      sampleRate: 48000,',
            '    },',
            '  });',
            '  const track = rawStream.getAudioTracks()[0];',
            '',
            '  // 2. MediaStreamTrackProcessor 取 AudioData 帧',
            '  const processor = new MediaStreamTrackProcessor({ track });',
            '  const reader = processor.readable.getReader();',
            '',
            '  // 3. AudioEncoder 编码（Opus/AAC/FLAC）',
            '  const encoder = new AudioEncoder({',
            '    output: (chunk: any, meta: any) => sendChunk(chunk, meta),',
            '    error: (e: any) => console.error(e),',
            '  });',
            '  encoder.configure({',
            '    codec: "opus",',
            '    sampleRate: 48000,',
            '    numberOfChannels: 2,',
            '    bitrate: 128000,',
            '  });',
            '',
            '  // 4. 循环读取帧并编码',
            '  while (true) {',
            '    const { value: audioData } = await reader.read();',
            '    if (!audioData) break;',
            '    encoder.encode(audioData);',
            '    audioData.close();',
            '  }',
            '',
            '【AGC 与 WebRTC analog/digital 模式】',
            '  - WebRTC 内部 AGC 模式（非 track 约束，SDP 协商层）：',
            '    • fixed digital：固定数字增益',
            '    • adaptive digital：自适应数字增益',
            '    • adaptive analog：自适应模拟增益（调节麦克风硬件）',
            '  - track.getSettings().autoGainControl 反映是否启用 AGC',
            '  - 具体模式由浏览器/WebRTC 内部决定，track 约束只控开关',
            '',
            '【浏览器支持】',
            '  Chrome/Edge：✓ 全支持',
            '  Safari：✓ 支持（部分版本默认关闭）',
            '  Firefox：✓ 支持',
            '  默认值：true（Chrome/Edge）',
            '',
            '【常见陷阱】',
            '  1. 音乐录制务必关闭 AGC，否则动态范围被压缩',
            '  2. AGC 会引入启动延迟（约 100-300ms 才稳定）',
            '  3. analog AGC 调节硬件增益可能与系统音量冲突',
            '  4. MediaStreamTrackProcessor 需 Chrome 94+，Safari 不支持',
            '',
            `【当前环境检测】`,
            `  getUserMedia: ${f.userMedia ? '✓' : '✗'}`,
            `  ${!f.userMedia ? 'jsdom 不可用，需真实浏览器演示 AGC 协同' : ''}`,
        ].join('\n');
        this.setState({ agcInfo: info });
        this._addLog(f.userMedia ? 'info' : 'warn', `autoGainControl 演示：${f.userMedia ? '已展示 WebCodecs 协同' : 'getUserMedia 不可用'}`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. autoGainControl 自动增益（AGC）—— 与 MediaStreamTrackProcessor + WebCodecs 协同',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: f.userMedia ? 'success' : 'error' }, f.userMedia ? '✓ AGC 可用' : '不可用'), h(Tag, { color: 'primary' }, 'WebCodecs 协同')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'autoGainControl 控制自动增益（AGC）算法开关。WebRTC AGC 基于 RMS 估计 + 增益曲线（analog 调硬件 / digital 软件乘系数），自动拉平音量。默认 true，通话场景使对方听感稳定。音乐录制场景关闭 AGC 保留动态范围。关闭所有处理后可用 MediaStreamTrackProcessor 取原始 AudioData 帧，配合 WebCodecs AudioEncoder 编码 Opus/AAC/FLAC（需 Chrome 94+）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('AGC 原理与用法', { type: 'primary', size: 'sm', onClick: () => this._runAgcDemo() }), this._btn('WebCodecs 协同方案', { size: 'sm', onClick: () => this._runAgcDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'autoGainControl 演示：'),
                h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } }, h('code', {}, s.agcInfo || '（点击「AGC 原理与用法」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, `// 关闭 AGC/NS/AEC 取原始音频 + WebCodecs 编码
const rawStream = await navigator.mediaDevices.getUserMedia({
  audio: { autoGainControl: false, noiseSuppression: false,
           echoCancellation: false, channelCount: 2, sampleRate: 48000 }
});
const track = rawStream.getAudioTracks()[0];
const processor = new MediaStreamTrackProcessor({ track });
const reader = processor.readable.getReader();
const encoder = new AudioEncoder({
  output: (chunk: any, meta: any) => sendChunk(chunk, meta),
  error: (e: any) => console.error(e),
});
encoder.configure({ codec: 'opus', sampleRate: 48000,
                    numberOfChannels: 2, bitrate: 128000 });
while (true) {
  const { value: audioData } = await reader.read();
  if (!audioData) break;
  encoder.encode(audioData);
  audioData.close();
}`)),
                h(Alert, {
                    type: 'info',
                    message: 'MediaStreamTrackProcessor + WebCodecs 取原始音频帧',
                    description: '关闭 AGC/NS/AEC 后，用 MediaStreamTrackProcessor（Chrome 94+）从 track 读取 AudioData 帧，配合 AudioEncoder 编码 Opus/AAC/FLAC，绕过浏览器内置处理实现完全可控的音频管线。Safari 不支持 MediaStreamTrackProcessor。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：channelCount/sampleRate/sampleSize ===================
    _runChannelDemo() {
        const f = this._flags();
        const info = [
            '===== channelCount / sampleRate / sampleSize =====',
            '',
            '【channelCount 声道数】',
            '  - 1：单声道（mono，通话场景默认，节省带宽）',
            '  - 2：立体声（stereo，音乐录制/ASMR）',
            '  - 多声道：5.1 / 7.1（环绕声，部分专业声卡支持）',
            '  - 约束形式：channelCount: { ideal: 2 } 或 { exact: 2 } 或 { min: 1, max: 2 }',
            '',
            '【sampleRate 采样率】',
            '  - 8000：电话语音（窄带，仅人声可懂）',
            '  - 16000：VoIP 宽带语音',
            '  - 44100：CD 音质',
            '  - 48000：专业音频/WebRTC 默认',
            '  - 约束形式：sampleRate: { ideal: 48000 }',
            '  - 注意：浏览器可能忽略约束，按设备原生采样率输出（如 macOS 48000）',
            '',
            '【sampleSize 位深】',
            '  - 16：CD/PCM 标准（S16LE）',
            '  - 24：专业音频',
            '  - 32：浮点音频（F32LE，Web Audio API 默认）',
            '  - 约束形式：sampleSize: { ideal: 16 }',
            '  - 注意：sampleSize 在部分浏览器（Chrome）已被废弃，getSettings 不返回',
            '',
            '【约束用法】',
            "  // 通话场景：单声道 + 16kHz（节省带宽）",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: {",
            "      channelCount: { ideal: 1 },",
            "      sampleRate: { ideal: 16000 },",
            "      sampleSize: { ideal: 16 },",
            "    },",
            "  });",
            '',
            "  // 音乐录制：立体声 + 48kHz",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: {",
            "      channelCount: { ideal: 2 },",
            "      sampleRate: { ideal: 48000 },",
            "      sampleSize: { ideal: 24 },",
            "    },",
            "  });",
            '',
            '【getSettings() 实际值 vs 约束值差异】',
            '  const track = stream.getAudioTracks()[0];',
            '  const settings = track.getSettings();',
            '  // 约束 channelCount: { ideal: 1 }',
            '  // settings.channelCount: 1（满足）或 2（设备仅支持立体声）',
            '',
            '  // 约束 sampleRate: { ideal: 48000 }',
            '  // settings.sampleRate: 48000（满足）或 44100（设备原生 44.1k）',
            '  // 浏览器可能 resample，但 settings 反映设备原生率',
            '',
            '  // 约束 sampleSize: { ideal: 16 }',
            '  // settings.sampleSize: 16 或 undefined（Chrome 已废弃）',
            '',
            '【getCapabilities() 设备能力边界】',
            '  const caps = track.getCapabilities();',
            '  caps.channelCount;   // { min: 1, max: 2 }',
            '  caps.sampleRate;     // { min: 44100, max: 48000 }',
            '  caps.sampleSize;     // { min: 16, max: 24 } 或 undefined',
            '',
            '【典型能力矩阵】',
            '  设备类型           channelCount   sampleRate          sampleSize',
            '  笔记本内置麦克风   1-2            44100-48000         16',
            '  USB 麦克风         1-2            44100-96000         16-24',
            '  专业声卡           1-8            44100-192000        16-32',
            '  蓝牙耳机           1              8000-48000          16',
            '  移动端麦克风       1              44100-48000         16',
            '',
            '【浏览器支持】',
            '  Chrome/Edge：channelCount ✓ / sampleRate ✓ / sampleSize 已废弃',
            '  Safari：channelCount ✓ / sampleRate 部分 / sampleSize ✗',
            '  Firefox：channelCount ✓ / sampleRate ✗ 忽略 / sampleSize ✗',
            '',
            '【常见陷阱】',
            '  1. sampleRate 约束可能被忽略，浏览器按设备原生率输出',
            '  2. sampleSize 在 Chrome 已废弃，getSettings 不返回，勿依赖',
            '  3. 蓝牙耳机受 HFP/HFP 协议限制，仅支持 8kHz/16kHz 单声道',
            '  4. 多声道（5.1/7.1）需专业声卡 + 麦克风阵列',
            '  5. 移动端默认 channelCount: 1，桌面端默认 2（差异大）',
            '',
            `【当前环境检测】`,
            `  getUserMedia: ${f.userMedia ? '✓' : '✗'}`,
            `  getCapabilities: ${f.getCapabilities ? '✓' : '✗'}`,
            `  getSettings: ${f.getSettings ? '✓' : '✗'}`,
            `  ${!f.userMedia ? 'jsdom 不可用，需真实浏览器演示采样率/声道能力' : ''}`,
        ].join('\n');
        this.setState({ channelInfo: info });
        this._addLog(f.getSettings ? 'info' : 'warn', `channelCount/sampleRate/sampleSize 演示：getSettings ${f.getSettings ? '可用' : '不可用'}`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. channelCount / sampleRate / sampleSize —— 约束值与实际值差异',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['getCapabilities', f.getCapabilities],
                ['getSettings', f.getSettings],
            ]), h(Tag, { color: 'primary' }, '1/2/多声道')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'channelCount（声道数 1/2/多声道）、sampleRate（采样率 8000/16000/44100/48000）、sampleSize（位深 16/24/32）是数值型约束，支持 ideal/exact/min/max。getSettings() 返回的实际值可能与约束值不同（设备不支持时浏览器降级或 resample）。sampleSize 在 Chrome 已废弃。getCapabilities() 返回 { min, max } 边界。蓝牙耳机受 HFP 协议限制仅支持 8/16kHz 单声道。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('声道/采样率/位深用法', { type: 'primary', size: 'sm', onClick: () => this._runChannelDemo() }), this._btn('能力矩阵', { size: 'sm', onClick: () => this._runChannelDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'channelCount/sampleRate/sampleSize 演示：'),
                h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } }, h('code', {}, s.channelInfo || '（点击「声道/采样率/位深用法」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } }, h('code', {}, `// 通话：单声道 16kHz；音乐：立体声 48kHz
const callStream = await navigator.mediaDevices.getUserMedia({
  audio: { channelCount: { ideal: 1 }, sampleRate: { ideal: 16000 } }
});
const musicStream = await navigator.mediaDevices.getUserMedia({
  audio: { channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } }
});
const track = musicStream.getAudioTracks()[0];
const caps = track.getCapabilities();
// caps.sampleRate: { min: 44100, max: 192000 }
const settings = track.getSettings();
// settings.sampleRate: 48000（满足）或 44100（设备原生 44.1k）
// 注意：sampleSize 在 Chrome 已废弃，settings.sampleSize 多为 undefined`)),
                h(Alert, {
                    type: 'warning',
                    message: '约束值 ≠ 实际值，必须用 getSettings() 验证',
                    description: 'sampleRate 约束可能被浏览器忽略（按设备原生率输出并 resample）。sampleSize 在 Chrome 已废弃，getSettings 不返回。蓝牙耳机受 HFP 协议限制仅支持 8/16kHz 单声道。务必用 track.getSettings() 读取实际值，勿假设约束被满足。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：latency 与 voiceIsolation ===================
    _runLatencyDemo() {
        const f = this._flags();
        let scVoice = false, scLatency = false;
        if (f.supportedConstraints) {
            try {
                const sc = navigator.mediaDevices.getSupportedConstraints();
                scVoice = !!sc.voiceIsolation;
                scLatency = !!sc.latency;
            }
            catch { /* noop */ }
        }
        this._injectStyle('mtc-latency-matrix', `
      .mtc-lat-matrix { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-top: 10px; }
      .mtc-lat-cell { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 12px; }
    `);
        const info = [
            '===== latency 与 voiceIsolation =====',
            '',
            '【latency 延迟约束】',
            '  - latency 约束控制音频处理管线的目标延迟（秒，浮点）',
            '  - 典型值：0.01（10ms，低延迟直播）/ 0.05（50ms，普通）/ 0.2（200ms，高延迟省电）',
            '  - 约束形式：latency: { ideal: 0.01 } 或 { max: 0.02 }',
            '  - 低延迟场景：游戏语音、乐器实时监听、AR/VR 通话',
            '  - 高延迟场景：普通通话、录音（省电，处理更充分）',
            '',
            '【约束用法】',
            "  // 低延迟直播（游戏语音、乐器监听）",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: { latency: { ideal: 0.01 } }   // 10ms 目标延迟",
            "  });",
            '',
            "  // 高延迟省电（普通通话）",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: { latency: { ideal: 0.2 } }    // 200ms 目标延迟",
            "  });",
            '',
            '【voiceIsolation AI 人声隔离】',
            '  - Chrome 126+ 引入的 AI 人声隔离约束',
            '  - 设备端 ML 模型实时分离人声与背景声',
            '  - 比 NS 更激进：保留人声，去除所有非人声（乐器、环境、他人声）',
            '  - 通话场景：开启 voiceIsolation 在嘈杂环境（咖啡馆、地铁）显著提升对方听感',
            '  - 录音场景：关闭 voiceIsolation 保留环境声',
            '',
            '【约束用法】',
            "  // 通话场景：开启 voiceIsolation（Chrome 126+）",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: { voiceIsolation: { ideal: true } }",
            "  });",
            '',
            "  // 录音场景：关闭 voiceIsolation 保留环境声",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: { voiceIsolation: false }",
            "  });",
            '',
            '【能力检测】',
            '  // 1. 全局：浏览器是否识别 voiceIsolation 约束键',
            '  const sc = navigator.mediaDevices.getSupportedConstraints();',
            `  当前环境 sc.voiceIsolation: ${scVoice ? 'true（浏览器识别）' : 'false（不支持或 jsdom）'}`,
            `  当前环境 sc.latency: ${scLatency ? 'true（浏览器识别）' : 'false（不支持或 jsdom）'}`,
            '',
            '  // 2. 设备：track.getCapabilities().voiceIsolation',
            '  //    [true, false] 表示可开可关',
            '',
            '  // 3. 实际值：track.getSettings().voiceIsolation',
            '  //    true / false',
            '',
            '【浏览器支持矩阵】',
            '  浏览器            latency       voiceIsolation',
            '  Chrome 126+       ✓ 支持        ✓ AI 人声隔离',
            '  Edge 126+         ✓ 支持        ✓',
            '  Chrome <126       ✓ 支持        ✗ 不支持',
            '  Safari 14+        ✗ 忽略        ✗ 不支持',
            '  Firefox           ✗ 忽略        ✗ 不支持',
            '  移动端 Chrome     ✓ 支持        ✓ Chrome 126+',
            '  移动端 Safari     ✗ 忽略        ✗',
            '',
            '【voiceIsolation vs noiseSuppression 区别】',
            '  NS（noiseSuppression）：',
            '    - 抑制稳态/非稳态背景噪声（风扇、键盘）',
            '    - 保留人声 + 部分环境声',
            '    - 算法：谱减 / Wiener / RNNoise',
            '  voiceIsolation：',
            '    - ML 模型分离人声与所有非人声',
            '    - 仅保留目标人声，去除他人声、乐器、环境',
            '    - 算法：端侧神经网络（Chrome 内置）',
            '    - 比 NS 更激进，可能误伤乐器/和声',
            '',
            '【与 WebRTC 协同】',
            '  - voiceIsolation 在 getUserMedia 层处理，WebRTC 直接传输处理后音频',
            '  - track.getSettings().voiceIsolation 反映实际开关',
            '  - RTCRtpSender.setParameters 不含 voiceIsolation（那是 track 层约束）',
            '  - 运行时切换：await track.applyConstraints({ voiceIsolation: false })',
            '',
            '【常见陷阱】',
            '  1. voiceIsolation 仅 Chrome 126+，Safari/Firefox 完全不支持',
            '  2. voiceIsolation 可能误伤乐器/和声，音乐场景慎用',
            '  3. latency 约束仅 Chrome 支持，Safari/Firefox 忽略',
            '  4. 低 latency 增加功耗（CPU 处理更频繁），移动端慎用',
            '  5. voiceIsolation 模型在低端设备可能引入额外延迟',
            '',
            `【当前环境检测】`,
            `  getSupportedConstraints: ${f.supportedConstraints ? '✓' : '✗'}`,
            `  voiceIsolation 约束识别: ${scVoice ? '✓' : '✗'}`,
            `  latency 约束识别: ${scLatency ? '✓' : '✗'}`,
            `  ${!f.supportedConstraints ? 'jsdom 不可用，需 Chrome 126+ 真实浏览器' : ''}`,
        ].join('\n');
        this.setState({ latencyInfo: info });
        this._addLog(f.supportedConstraints ? 'info' : 'warn', `latency/voiceIsolation 演示：voiceIsolation 约束 ${scVoice ? '识别' : '不识别（需 Chrome 126+）'}`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. latency 与 voiceIsolation —— 低延迟直播 + Chrome 126+ AI 人声隔离',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: f.supportedConstraints ? 'success' : 'error' }, f.supportedConstraints ? '✓ getSupportedConstraints' : '不可用'), h(Tag, { color: 'primary' }, 'Chrome 126+ voiceIsolation')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'latency 控制音频处理管线目标延迟（秒，0.01 低延迟直播 / 0.2 省电），仅 Chrome 支持。voiceIsolation 是 Chrome 126+ 引入的 AI 人声隔离约束，端侧 ML 模型分离人声与所有非人声（含他人声、乐器），比 noiseSuppression 更激进。getSupportedConstraints().voiceIsolation 检测浏览器是否识别。Safari/Firefox 完全不支持两者。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('latency/voiceIsolation 用法', { type: 'primary', size: 'sm', onClick: () => this._runLatencyDemo() }), this._btn('浏览器支持矩阵', { size: 'sm', onClick: () => this._runLatencyDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'latency 与 voiceIsolation 演示：'),
                h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } }, h('code', {}, s.latencyInfo || '（点击「latency/voiceIsolation 用法」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } }, h('code', {}, `// 低延迟直播 + AI 人声隔离（Chrome 126+）
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    latency: { ideal: 0.01 },        // 10ms 目标延迟
    voiceIsolation: { ideal: true },  // AI 人声隔离
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
  }
});
const track = stream.getAudioTracks()[0];
const sc = navigator.mediaDevices.getSupportedConstraints();
if (!sc.voiceIsolation) {
  console.warn('voiceIsolation 不被浏览器支持，约束被忽略');
}
console.log(track.getSettings().voiceIsolation); // true / undefined`)),
                h(Alert, {
                    type: 'info',
                    message: 'voiceIsolation 仅 Chrome 126+，需能力检测降级',
                    description: 'voiceIsolation 是 Chrome 126+ 引入的 AI 人声隔离约束，Safari/Firefox 完全不支持。务必用 getSupportedConstraints().voiceIsolation 检测后传入，否则约束被忽略。latency 同理仅 Chrome 支持。语音通话场景开启 voiceIsolation 在嘈杂环境显著提升对方听感。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：applyConstraints 动态切换 ===================
    _runApplyDemo() {
        const f = this._flags();
        const info = [
            '===== applyConstraints 动态切换约束 =====',
            '',
            '【applyConstraints 核心价值】',
            '  - 运行时修改 track 约束，无需重新 getUserMedia（避免权限弹窗 + track 重建）',
            '  - 应用场景：通话中切换 AEC/NS/AGC、录音中动态调整声道/采样率',
            '  - 签名：track.applyConstraints(constraints) → Promise<void>',
            '  - 失败时抛 OverconstrainedError（constraint 字段说明哪个约束无法满足）',
            '',
            '【约束用法】',
            "  // 1. getUserMedia 取得 track",
            "  const stream = await navigator.mediaDevices.getUserMedia({",
            "    audio: { echoCancellation: true, noiseSuppression: true }",
            "  });",
            "  const track = stream.getAudioTracks()[0];",
            '',
            "  // 2. 运行时关闭 echoCancellation（无需重新 getUserMedia）",
            "  await track.applyConstraints({ echoCancellation: false });",
            "  console.log(track.getSettings().echoCancellation); // false",
            '',
            "  // 3. 同时切换多个约束",
            "  await track.applyConstraints({",
            "    echoCancellation: false,",
            "    noiseSuppression: false,",
            "    autoGainControl: false,",
            "    channelCount: 2,",
            "    sampleRate: 48000,",
            "  });",
            '',
            "  // 4. 用 ideal/exact 形式",
            "  await track.applyConstraints({",
            "    channelCount: { exact: 2 },   // 必须立体声，否则 OverconstrainedError",
            "    sampleRate: { ideal: 48000 }, // 尽量 48kHz",
            "  });",
            '',
            '【overconstrained 事件】',
            '  - 当 applyConstraints 的约束无法满足时触发',
            '  - track.onoverconstrained = (event: any) => {}（部分浏览器）',
            '  - 或 track.addEventListener("overconstrained", handler)',
            '  - event.constraint 字段说明哪个约束无法满足',
            '  - applyConstraints 也会 reject Promise（OverconstrainedError）',
            '',
            "  // 监听 overconstrained",
            "  track.onoverconstrained = (event: any) => {",
            "    console.warn('约束无法满足:', event.constraint);",
            "  };",
            "  // 或 addEventListener（兼容性更好）",
            "  track.addEventListener($1, (event: any) => {",
            "    console.warn('overconstrained:', event.constraint);",
            "  });",
            '',
            "  // try/catch 捕获 OverconstrainedError",
            "  try {",
            "    await track.applyConstraints({ sampleRate: { exact: 192000 } });",
            "  } catch (err: any) {",
            "    if (err.name === 'OverconstrainedError') {",
            "      console.warn('设备不支持:', err.constraint); // 'sampleRate'",
            "      // 降级到 ideal",
            "      await track.applyConstraints({ sampleRate: { ideal: 48000 } });",
            "    }",
            "  }",
            '',
            '【applyConstraints vs 重新 getUserMedia】',
            '  applyConstraints：',
            '    - 同一 track，不触发权限弹窗',
            '    - 保留 track.id / 已建立的 RTCPeerConnection',
            '    - 切换开销小（仅修改约束，不重建管线）',
            '    - 部分约束切换可能瞬时中断音频（约 50-200ms）',
            '  重新 getUserMedia：',
            '    - 新 track（id 变化），需重新协商 RTC',
            '    - 可能触发权限弹窗（部分浏览器缓存权限）',
            '    - 切换开销大（重建管线，约 300-800ms）',
            '    - 适合 deviceId 切换（换麦克风）',
            '',
            '【与 RTCRtpSender.setParameters() 区别】',
            '  applyConstraints（track 层）：',
            '    - 修改 track 的源约束（AEC/NS/AGC/channelCount/sampleRate）',
            '    - 影响源采集与预处理',
            '    - track.getSettings() 反映新值',
            '    - 不影响编码/RTP 发送',
            '  setParameters（RTP 层）：',
            '    - 修改 RTP 发送参数（编码 bitrate/codec/分辨率/rid）',
            '    - sender.setParameters({ encodings: [{ maxBitrate: 64000 }] })',
            '    - 影响 AudioEncoder/VideoEncoder 输出',
            '    - 不影响源采集',
            '  两者正交：可同时用 applyConstraints 调源 + setParameters 调编码',
            '',
            "  // 同时调整源 + 编码",
            "  const sender = pc.getSenders().find((s: any) => s.track.kind === 'audio');",
            "  // 1. track 层：关闭 AEC",
            "  await sender.track.applyConstraints({ echoCancellation: false });",
            "  // 2. RTP 层：调整 Opus bitrate",
            "  const params = sender.getParameters();",
            "  params.encodings[0].maxBitrate = 32000;  // 32kbps Opus",
            "  await sender.setParameters(params);",
            '',
            '【兼容性】',
            '  Chrome/Edge：applyConstraints ✓ / overconstrained 事件 ✓',
            '  Safari：applyConstraints ✓ 部分 / overconstrained 事件 ✗（仅 Promise reject）',
            '  Firefox：applyConstraints ✓ / overconstrained 事件 ✗',
            '  注意：Safari/Firefox 仅通过 Promise reject 通知约束失败，无 overconstrained 事件',
            '',
            '【常见陷阱】',
            '  1. exact 约束无法满足时抛 OverconstrainedError，建议优先 ideal',
            '  2. onoverconstrained 在 Safari/Firefox 不触发，需 try/catch Promise',
            '  3. applyConstraints 切换可能瞬时中断音频（约 50-200ms）',
            '  4. 不能用 applyConstraints 切换 deviceId（需重新 getUserMedia）',
            '  5. applyConstraints 后必须 getSettings() 验证实际值',
            '',
            `【当前环境检测】`,
            `  applyConstraints: ${f.applyConstraints ? '✓' : '✗'}`,
            `  onoverconstrained: ${f.onoverconstrained ? '✓' : '✗'}（${f.onoverconstrained ? '部分浏览器支持' : 'Safari/Firefox 不支持，需 try/catch'}）`,
            `  ${!f.applyConstraints ? 'jsdom 不可用，需真实浏览器演示动态切换' : ''}`,
        ].join('\n');
        this.setState({ applyInfo: info });
        this._addLog(f.applyConstraints ? 'info' : 'warn', `applyConstraints 演示：${f.applyConstraints ? '可用' : '不可用'}，onoverconstrained ${f.onoverconstrained ? '支持' : '不支持'}`);
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. applyConstraints 动态切换 —— 运行时切换约束无需重新 getUserMedia',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['applyConstraints', f.applyConstraints],
                ['onoverconstrained', f.onoverconstrained],
            ]), h(Tag, { color: 'primary' }, 'OverconstrainedError')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'track.applyConstraints(constraints) 运行时修改约束，无需重新 getUserMedia（避免权限弹窗 + track 重建），适合通话中切换 AEC/NS/AGC。失败时抛 OverconstrainedError（constraint 字段说明哪个约束无法满足）。track.onoverconstrained 事件监听约束无法满足（Safari/Firefox 不触发，需 try/catch Promise）。与 RTCRtpSender.setParameters() 正交：前者调源采集，后者调 RTP 编码。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('applyConstraints 用法', { type: 'primary', size: 'sm', onClick: () => this._runApplyDemo() }), this._btn('overconstrained 事件', { size: 'sm', onClick: () => this._runApplyDemo() }), this._btn('vs setParameters', { size: 'sm', onClick: () => this._runApplyDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'applyConstraints 演示：'),
                h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } }, h('code', {}, s.applyInfo || '（点击「applyConstraints 用法」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, `// 运行时切换 AEC + 监听 overconstrained
const track = stream.getAudioTracks()[0];
track.addEventListener($1, (e: any) => {
  console.warn('约束无法满足:', e.constraint);
});
try {
  await track.applyConstraints({
    echoCancellation: false,
    noiseSuppression: false,
    channelCount: { exact: 2 },  // 必须立体声
  });
  console.log(track.getSettings()); // 验证实际值
} catch (err: any) {
  if (err.name === 'OverconstrainedError') {
    console.warn('失败约束:', err.constraint);
    await track.applyConstraints({ channelCount: { ideal: 2 } }); // 降级
  }
}`)),
                h(Alert, {
                    type: 'warning',
                    message: 'onoverconstrained 在 Safari/Firefox 不触发，需 try/catch Promise',
                    description: 'Safari/Firefox 不触发 overconstrained 事件，仅通过 applyConstraints 返回的 Promise reject 通知约束失败（OverconstrainedError）。必须用 try/catch 捕获并降级。Chrome/Edge 同时支持事件 + Promise。exact 约束过严会立即失败，建议优先 ideal。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 8：实战模式与陷阱 ===================
    _runPatternDemo() {
        const f = this._flags();
        this._injectStyle('mtc-pattern-matrix', `
      .mtc-pat-matrix { display: grid; grid-template-columns: 220px 1fr 1fr; gap: 6px; margin-top: 10px; font-size: 12px; }
      .mtc-pat-matrix > div { padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; background: #fff; }
      .mtc-pat-head { background: #1e293b !important; color: #fff !important; font-weight: 600; }
      .mtc-pat-col { background: #3b82f6 !important; color: #fff !important; font-weight: 600; }
    `);
        const info = [
            '===== 实战模式与陷阱清单 =====',
            '',
            '【WebRTC 通话约束调优矩阵】',
            '  场景              约束配置                                    说明',
            '  普通通话          AEC✓ NS✓ AGC✓ channel 1 sr 16k             默认值，节省带宽',
            '  高清通话          AEC✓ NS✓ AGC✓ channel 1 sr 48k             Opus 48k 高音质',
            '  会议演讲          AEC✓ NS✓ AGC✗ channel 1 sr 48k             演讲者动态范围大，关 AGC',
            '  嘈杂环境通话      AEC✓ NS✓ AGC✓ voiceIsolation✓              Chrome 126+ AI 隔离',
            '  低延迟游戏语音    AEC✓ NS✓ AGC✓ latency 0.01                  10ms 延迟',
            '  蓝牙耳机通话      AEC✓ NS✓ AGC✓ channel 1 sr 8-16k           HFP 协议限制',
            '',
            '【录音 vs 通话差异化配置】',
            '  录音场景（音乐/播客/ASR 训练数据）：',
            '    audio: {',
            '      echoCancellation: false,    // 保留原始声学',
            '      noiseSuppression: false,    // 保留细节',
            '      autoGainControl: false,     // 保留动态范围',
            '      voiceIsolation: false,      // 保留环境声',
            '      channelCount: { ideal: 2 }, // 立体声',
            '      sampleRate: { ideal: 48000 },',
            '    }',
            '',
            '  通话场景（WebRTC）：',
            '    audio: {',
            '      echoCancellation: true,     // 必备，免提防回声',
            '      noiseSuppression: true,     // 抑制背景噪声',
            '      autoGainControl: true,      // 拉平音量',
            '      voiceIsolation: true,       // Chrome 126+ AI 隔离',
            '      channelCount: { ideal: 1 }, // 单声道节省带宽',
            '      sampleRate: { ideal: 48000 },',
            '    }',
            '',
            '【9 大陷阱清单】',
            '  1. 移动端默认值差异：channelCount 默认 1（桌面 2），sampleRate 默认 44100',
            '  2. Safari 部分约束不支持：sampleSize 不支持、latency 忽略、voiceIsolation 不支持',
            '  3. getCapabilities() 不完整：Firefox 完全不支持，Safari 部分返回 undefined',
            '  4. sampleRate 约束被忽略：浏览器按设备原生率输出并 resample',
            '  5. sampleSize 在 Chrome 已废弃：getSettings 不返回，勿依赖',
            '  6. exact 约束过严抛 OverconstrainedError：建议优先 ideal',
            '  7. onoverconstrained 在 Safari/Firefox 不触发：需 try/catch Promise',
            '  8. 蓝牙耳机 HFP 限制：仅 8/16kHz 单声道，约束 48kHz 立体声必失败',
            '  9. applyConstraints 切换瞬时中断：约 50-200ms，敏感场景慎用',
            '',
            '【降级方案】',
            '  // 1. 能力检测 + 渐进增强',
            '  const sc = navigator.mediaDevices.getSupportedConstraints();',
            '  const constraints = {',
            '    echoCancellation: true,',
            '    noiseSuppression: true,',
            '    autoGainControl: true,',
            '  };',
            '  if (sc.voiceIsolation) constraints.voiceIsolation = true;',
            '  if (sc.latency) constraints.latency = { ideal: 0.05 };',
            '  const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });',
            '',
            '  // 2. getCapabilities 不可用降级（Firefox）',
            '  const track = stream.getAudioTracks()[0];',
            '  let caps = {};',
            '  if (typeof track.getCapabilities === "function") {',
            '    caps = track.getCapabilities();',
            '  } else {',
            '    console.warn("getCapabilities 不支持，跳过能力检测");',
            '  }',
            '',
            '  // 3. applyConstraints 失败降级',
            '  try {',
            '    await track.applyConstraints({ sampleRate: { exact: 48000 } });',
            '  } catch (err: any) {',
            '    if (err.name === "OverconstrainedError") {',
            '      await track.applyConstraints({ sampleRate: { ideal: 48000 } });',
            '    }',
            '  }',
            '',
            '  // 4. 完全降级：MediaRecorder + 服务端处理',
            '  //    浏览器内置处理不可用时，用 MediaRecorder 录原始 PCM',
            '  //    上传服务端用 WebRTC APM / RNNoise 处理',
            '',
            '【与 RTCRtpSender.setParameters() 区别（关键）】',
            '  MediaTrackConstraints（track 层）：',
            '    - 作用于源采集与预处理（getUserMedia 之前/期间）',
            '    - 影响音频源属性：AEC/NS/AGC/channelCount/sampleRate/voiceIsolation',
            '    - API：getUserMedia({ audio: {...} }) / track.applyConstraints({...})',
            '    - 检测：track.getSettings() / track.getCapabilities()',
            '',
            '  RTCRtpParameters（RTP 层）：',
            '    - 作用于 RTP 发送与编码（getUserMedia 之后，传输之前）',
            '    - 影响编码参数：codec/bitrate/rid/scalabilityMode/maxFramerate',
            '    - API：sender.getParameters() / sender.setParameters(params)',
            '    - 检测：sender.getParameters().encodings[0].maxBitrate',
            '',
            '  两者正交，可同时调整：',
            '    await track.applyConstraints({ echoCancellation: false });  // 源层',
            '    const params = sender.getParameters();',
            '    params.encodings[0].maxBitrate = 32000;                     // RTP 层',
            '    await sender.setParameters(params);',
            '',
            '【实战：完整通话约束配置示例】',
            "  async function setupCallAudio() {",
            "    const sc = navigator.mediaDevices.getSupportedConstraints();",
            "    const constraints = {",
            "      echoCancellation: { ideal: true },",
            "      noiseSuppression: { ideal: true },",
            "      autoGainControl: { ideal: true },",
            "      channelCount: { ideal: 1 },",
            "      sampleRate: { ideal: 48000 },",
            "    };",
            "    if (sc.voiceIsolation) constraints.voiceIsolation = { ideal: true };",
            "    if (sc.latency) constraints.latency = { ideal: 0.05 };",
            "",
            "    const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });",
            "    const track = stream.getAudioTracks()[0];",
            "",
            "    // 验证实际值",
            "    const settings = track.getSettings();",
            "    console.log('实际配置:', settings);",
            "",
            "    // 监听 overconstrained（Chrome/Edge）",
            "    track.addEventListener($1, (e: any) => {",
            "      console.warn('约束失败:', e.constraint);",
            "    });",
            "",
            "    return stream;",
            "  }",
            '',
            `【当前环境检测】`,
            `  getUserMedia: ${f.userMedia ? '✓' : '✗'}`,
            `  getCapabilities: ${f.getCapabilities ? '✓' : '✗（Firefox 完全不支持）'}`,
            `  applyConstraints: ${f.applyConstraints ? '✓' : '✗'}`,
            `  getSupportedConstraints: ${f.supportedConstraints ? '✓' : '✗'}`,
            `  ${!f.userMedia ? 'jsdom 不可用，需真实浏览器演示完整通话配置' : ''}`,
        ].join('\n');
        this.setState({ patternInfo: info });
        this._addLog(f.userMedia ? 'info' : 'warn', `实战模式演示：${f.userMedia ? '已展示通话/录音配置矩阵' : 'getUserMedia 不可用，仅文档'}`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 实战与陷阱 —— WebRTC 调优矩阵 + 录音/通话差异化 + 降级方案',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['getUserMedia', f.userMedia],
                ['supportedConstraints', f.supportedConstraints],
            ]), h(Tag, { color: 'primary' }, '9 大陷阱')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'WebRTC 通话约束调优矩阵（普通/高清/演讲/嘈杂/低延迟/蓝牙场景）。录音 vs 通话差异化配置：录音关闭所有处理保留原始音频，通话开启 AEC/NS/AGC/voiceIsolation。9 大陷阱：移动端默认值差异、Safari 部分约束不支持、getCapabilities() 不完整（Firefox 完全不支持）、sampleRate 被忽略、sampleSize 已废弃、exact 过严、onoverconstrained 不触发、蓝牙 HFP 限制、applyConstraints 瞬时中断。降级方案 + 与 RTCRtpSender.setParameters() 区别。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('调优矩阵 + 陷阱清单', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }), this._btn('降级方案', { size: 'sm', onClick: () => this._runPatternDemo() }), this._btn('vs setParameters', { size: 'sm', onClick: () => this._runPatternDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '实战模式与陷阱：'),
                h('pre', { class: 'code-block', style: { maxHeight: '380px', overflow: 'auto' } }, h('code', {}, s.patternInfo || '（点击「调优矩阵 + 陷阱清单」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, `// 完整通话约束配置（能力检测 + 渐进增强）
const sc = navigator.mediaDevices.getSupportedConstraints();
const constraints = {
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  channelCount: { ideal: 1 }, sampleRate: { ideal: 48000 },
};
if (sc.voiceIsolation) constraints.voiceIsolation = { ideal: true };
if (sc.latency) constraints.latency = { ideal: 0.05 };
const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
const track = stream.getAudioTracks()[0];
track.addEventListener($1, (e: any) => console.warn(e.constraint));
console.log(track.getSettings());  // 验证实际值
// 注意：与 sender.setParameters() 正交，前者调源，后者调 RTP 编码`)),
                h(Alert, {
                    type: 'warning',
                    message: 'MediaTrackConstraints（track 层）与 RTCRtpParameters（RTP 层）正交',
                    description: 'MediaTrackConstraints 作用于源采集与预处理（AEC/NS/AGC/channelCount/sampleRate/voiceIsolation），API 是 getUserMedia/applyConstraints；RTCRtpParameters 作用于 RTP 发送与编码（codec/bitrate/rid），API 是 sender.getParameters/setParameters。两者可同时调整，互不影响。Firefox 完全不支持 getCapabilities，需能力检测降级。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板 ===================
    _renderLogPanel() {
        const s = this.state;
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)), s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'page api-lab-page' }, h('h2', { class: 'section-title' }, 'MediaTrackConstraints 深度实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 MediaTrackConstraints 约束模型（ideal/exact/min/max）与音频约束深潜：echoCancellation 回声消除（AEC）、noiseSuppression 降噪（NS/RNNoise）、autoGainControl 自动增益（AGC）、channelCount/sampleRate/sampleSize 声道/采样率/位深、latency 低延迟、voiceIsolation Chrome 126+ AI 人声隔离、applyConstraints 运行时动态切换、实战与陷阱（WebRTC 调优矩阵/录音 vs 通话差异化/降级方案/与 RTCRtpSender.setParameters 区别）。所有 API 调用前做 typeof 能力检测，jsdom 不可用时仅记日志说明。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8(), this._renderLogPanel());
    }
}
//# sourceMappingURL=MediaTrackConstraintsPage.js.map