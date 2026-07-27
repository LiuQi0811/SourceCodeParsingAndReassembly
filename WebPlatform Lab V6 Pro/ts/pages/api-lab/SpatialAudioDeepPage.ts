// =====================================================================
// SpatialAudioDeepPage.js —— Web Audio 空间音频（3D 定位）深度实验室
// 演示 W3C Web Audio API 空间化子能力（与 AdvancedWebAudioPage 的节点拓扑/
// 频谱/Worklet 互补，本页专注 PannerNode / AudioListener / 声锥 / WebXR 协同）：
//   1. 概念与 AudioListener（BaseAudioContext.listener 单例 + positionX/Y/Z、
//      forwardX/Y/Z、upX/Y/Z 九个 AudioParam + 动画化监听者）
//   2. PannerNode 基础（构造 + panningModel: equalpower vs HRTF 双耳渲染 + 性能对比）
//   3. 声源位置与朝向（positionX/Y/Z + orientationX/Y/Z + AudioParam 自动化）
//   4. 距离衰减（distanceModel: linear/inverse/exponential + refDistance/
//      maxDistance/rolloffFactor）
//   5. 声锥与立体声（coneInnerAngle/coneOuterAngle/coneOuterGain 指向性声锥 +
//      StereoPannerNode 简易立体声 + channelCount）
//   6. WebXR 协同（AudioListener 与 WebXR requestAnimationFrame 同步 + 头部跟踪 +
//      XRRigidTransform 转换 + WebXR space + Web Audio 协同）
//   7. 多声道与 Ambisonics（ChannelMergerNode/ChannelSplitterNode 多声道 +
//      MediaElementAudioSourceNode 视频空间化 + Ambisonics 高阶环绕声）
//   8. 性能与生态（HRTF vs equalpower CPU 开销 + PannerNode 数量上限 +
//      AudioWorklet 自定义 HRTF 卷积 + ResonanceAudio 集成 + 浏览器支持矩阵）
// 说明：Web Audio API 在真实浏览器中可用（Chrome/Firefox/Edge/Safari 均支持
//       AudioContext/PannerNode）。jsdom/Node 环境 typeof 检测全部为 false，
//       所有 API 调用前做能力检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常。真实浏览器可创建 PannerNode 并用 requestAnimationFrame
//       动画化声源位置，演示 3D 空间化效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { State } from '../../core/types.js';

// ===================== 模块级常量 =====================

// PannerNode.panningModel 取值
const PANNING_MODELS = ['equalpower', 'HRTF'];

// PannerNode.distanceModel 取值
const DISTANCE_MODELS = ['linear', 'inverse', 'exponential'];

interface SpatialAudioDeepPageState extends State {
  logs: any;
  capsSummary: any;
  listenerInfo: any;
  pannerBasicInfo: any;
  positionInfo: any;
  distanceInfo: any;
  coneInfo: any;
  webxrInfo: any;
  multichannelInfo: any;
  perfInfo: any;
}

export class SpatialAudioDeepPage extends Page {
  declare state: SpatialAudioDeepPageState;
  _audioCtx!: any | null;
  _dynamicStyles!: any[];
  _inited!: boolean;
  _nodes!: any[];
  _oscillators!: any;
  _pannerRaf!: any;
  _stopTimers!: any;

  initialState() {
    return {
      logs: [],
      capsSummary: '',
      listenerInfo: '',       // Card 1：概念与 AudioListener
      pannerBasicInfo: '',    // Card 2：PannerNode 基础
      positionInfo: '',      // Card 3：声源位置与朝向
      distanceInfo: '',       // Card 4：距离衰减
      coneInfo: '',           // Card 5：声锥与立体声
      webxrInfo: '',          // Card 6：WebXR 协同
      multichannelInfo: '',   // Card 7：多声道与 Ambisonics
      perfInfo: '',           // Card 8：性能与生态
    };
  }

  // —— 生命周期 ——

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    // 初始化实例引用
    this._dynamicStyles = [];
    this._pannerRaf = null;
    this._audioCtx = null;
    this._nodes = [];
    this._oscillators = [];
    this._stopTimers = [];

    // 一次性能力检测（均做 typeof / in 检测，jsdom 不可用时仅记日志）
    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `AudioContext ${c(f.audioContext)}`,
      `PannerNode ${c(f.pannerNode)}`,
      `StereoPannerNode ${c(f.stereoPannerNode)}`,
      `AudioWorklet ${c(f.audioWorklet)}`,
      `WebXR ${c(f.webxr)}`,
    ];

    const any = f.audioContext && f.pannerNode;
    const summary = any
      ? `空间音频能力检测：${parts.join(' · ')}。当前环境支持 AudioContext + PannerNode，真实浏览器可创建 3D 空间化节点并用 requestAnimationFrame 动画化声源位置。`
      : `空间音频能力检测：${parts.join(' · ')}。jsdom/Node 环境无 AudioContext/PannerNode，所有按钮点击仅记日志说明，不会抛异常；真实浏览器（Chrome/Firefox/Edge/Safari）可完整体验。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.audioContext) this._addLog('warn', 'AudioContext 不可用（jsdom 无 Web Audio，真实浏览器需 Chrome/Firefox/Edge/Safari）');
    if (!f.pannerNode) this._addLog('warn', 'PannerNode 不可用（3D 空间化核心节点缺失）');
    if (!f.stereoPannerNode) this._addLog('warn', 'StereoPannerNode 不可用（简易立体声节点缺失，部分老浏览器）');
    if (!f.webxr) this._addLog('warn', 'WebXR 不可用（navigator.xr 缺失，头部跟踪演示不可用）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 1. 取消声源位置动画帧
    if (this._pannerRaf) {
      cancelAnimationFrame(this._pannerRaf);
      this._pannerRaf = null;
    }
    // 2. 清理停止定时器
    (this._stopTimers || []).forEach((t: any) => clearTimeout(t));
    this._stopTimers = [];
    // 3. 停止振荡器并断开节点
    (this._oscillators || []).forEach((o: any) => {
      try { o.stop(); } catch { /* 已停止 */ }
      try { o.disconnect(); } catch { /* noop */ }
    });
    (this._nodes || []).forEach((n: any) => {
      try { n.disconnect(); } catch { /* noop */ }
    });
    this._oscillators = [];
    this._nodes = [];
    // 4. 关闭 AudioContext
    if (this._audioCtx) {
      try { this._audioCtx.close(); } catch { /* noop */ }
      this._audioCtx = null;
    }
    // 5. 移除动态样式
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
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

  _caps(items: any) {
    return items.map(([label, ok]: any) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _flags() {
    const safe = (fn: any) => {
      try { return fn(); } catch { return false; }
    };
    return {
      audioContext: safe(() => typeof (window.AudioContext || window.webkitAudioContext) === 'function'),
      pannerNode: safe(() => 'PannerNode' in window),
      stereoPannerNode: safe(() => 'StereoPannerNode' in window),
      channelMergerNode: safe(() => 'ChannelMergerNode' in window),
      channelSplitterNode: safe(() => 'ChannelSplitterNode' in window),
      mediaElementAudioSourceNode: safe(() => 'MediaElementAudioSourceNode' in window),
      audioWorklet: safe(() => 'AudioWorkletNode' in window),
      webxr: safe(() => 'xr' in navigator),
    };
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
    this._injectStyle('spatial-audio-base', `
      .spatial-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .spatial-scene {
        position: relative;
        width: 100%;
        height: 200px;
        background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
        border-radius: 8px;
        margin-top: 10px;
        overflow: hidden;
      }
      .spatial-listener {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 24px;
        height: 24px;
        transform: translate(-50%, -50%);
        background: #38bdf8;
        border-radius: 50%;
        border: 2px solid #fff;
        box-shadow: 0 0 12px #38bdf8;
      }
      .spatial-listener::after {
        content: '👂';
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      }
      .spatial-source {
        position: absolute;
        width: 20px;
        height: 20px;
        background: #f59e0b;
        border-radius: 50%;
        border: 2px solid #fff;
        box-shadow: 0 0 10px #f59e0b;
        transition: left 0.05s linear, top 0.05s linear;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
      }
      .spatial-source::after { content: '🔊'; }
      .spatial-axes {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .spatial-axis-x, .spatial-axis-z {
        position: absolute;
        background: rgba(148, 163, 184, 0.25);
      }
      .spatial-axis-x { left: 0; right: 0; top: 50%; height: 1px; }
      .spatial-axis-z { top: 0; bottom: 0; left: 50%; width: 1px; }
      .spatial-status {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .spatial-status--ok { background: #dcfce7; color: #166534; }
      .spatial-status--no { background: #fee2e2; color: #991b1b; }
      .spatial-status--run { background: #dbeafe; color: #1e40af; }
      .spatial-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
  }

  _track(node: any) {
    (this._nodes = this._nodes || []).push(node);
    return node;
  }

  _trackOsc(osc: any) {
    (this._oscillators = this._oscillators || []).push(osc);
    return osc;
  }

  /** 安全创建/复用 AudioContext（jsdom 不可用返回 null） */
  _ensureCtx() {
    if (this._audioCtx) return this._audioCtx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (typeof Ctor !== 'function') {
      this._addLog('warn', 'AudioContext 不可用（typeof AudioContext === "undefined"）');
      return null as any;
    }
    try {
      this._audioCtx = new Ctor();
      this._addLog('info', `new AudioContext()：sampleRate=${this._audioCtx.sampleRate}Hz，state=${this._audioCtx.state}`);
      return this._audioCtx;
    } catch (err: any) {
      this._addLog('warn', `AudioContext 创建失败：${err && err.message}`);
      return null as any;
    }
  }

  // ===================== Card 1：概念与 AudioListener =====================

  _runListenerDemo() {
    const f = this._flags();
    let liveResult = '';
    // 真实浏览器：读取 listener 的 AudioParam
    if (f.audioContext) {
      const ctx = this._ensureCtx();
      if (ctx) {
        try {
          const listener = ctx.listener;
          const hasPos = listener && 'positionX' in listener;
          const hasFwd = listener && 'forwardX' in listener;
          const hasUp = listener && 'upX' in listener;
          liveResult = [
            '',
            '【实际 listener 检测】',
            `  ctx.listener 存在：${listener ? '✓' : '✗'}`,
            `  positionX/Y/Z（AudioParam）：${hasPos ? '✓' : '✗（旧版仅 setPosition() 方法）'}`,
            `  forwardX/Y/Z（AudioParam）：${hasFwd ? '✓' : '✗（旧版仅 setOrientation() 方法）'}`,
            `  upX/Y/Z（AudioParam）：${hasUp ? '✓' : '✗'}`,
          ].join('\n');
          // 设置监听者朝向（默认 +Z 朝前？规范默认 forward=(0,0,-1), up=(0,1,0)）
          if (hasPos) {
            listener.positionX.value = 0;
            listener.positionY.value = 0;
            listener.positionZ.value = 0;
          }
          if (hasFwd) {
            listener.forwardX.value = 0;
            listener.forwardY.value = 0;
            listener.forwardZ.value = -1;
          }
          if (hasUp) {
            listener.upX.value = 0;
            listener.upY.value = 1;
            listener.upZ.value = 0;
          }
          this._addLog('audio', `listener 已重置：position=(0,0,0) forward=(0,0,-1) up=(0,1,0)`);
        } catch (err: any) {
          this._addLog('warn', `listener 检测失败：${err && err.message}`);
        }
      }
    } else {
      this._addLog('warn', 'AudioContext 不可用，跳过 listener 真实检测（jsdom 无 Web Audio）');
    }

    const info = [
      '===== 空间音频概念与 AudioListener =====',
      '',
      '【空间音频（Spatial Audio）概念】',
      '  空间音频 = 3D 定位音频，模拟真实世界中声音随距离/方位/朝向衰减',
      '  核心：听者（AudioListener）+ 声源（PannerNode）+ 双耳渲染（HRTF）',
      '  人耳通过 ITD（双耳时间差）/ ILD（双耳电平差）/ HRTF（头相关传递函数）',
      '  重建空间方位，PannerNode 在频域实现 HRTF 卷积渲染双耳立体声',
      '',
      '【AudioListener —— 监听者（听者位置与朝向）】',
      '  // 每个 AudioContext 只有一个 listener（BaseAudioContext.listener 只读）',
      '  const ctx = new AudioContext();',
      '  const listener = ctx.listener;',
      '',
      '  // 9 个 AudioParam（现代浏览器）：',
      '  //   positionX/Y/Z   —— 监听者世界坐标',
      '  //   forwardX/Y/Z    —— 朝向向量（默认 (0,0,-1) 朝前）',
      '  //   upX/Y/Z        —— 头顶向量（默认 (0,1,0) 朝上）',
      '  listener.positionX.value = 0;',
      '  listener.positionY.value = 0;',
      '  listener.positionZ.value = 0;',
      '  listener.forwardX.value = 0;',
      '  listener.forwardY.value = 0;',
      '  listener.forwardZ.value = -1;  // 朝向 -Z（OpenGL 习惯）',
      '  listener.upX.value = 0;',
      '  listener.upY.value = 1;',
      '  listener.upZ.value = 0;',
      '',
      '【旧版 setPosition / setOrientation 方法（已废弃）】',
      '  // 旧规范用方法，现代浏览器改用 AudioParam',
      '  listener.setPosition(x, y, z);',
      '  listener.setOrientation(fx, fy, fz, ux, uy, uz);',
      '  // 检测：typeof listener.setPosition === "function"',
      '',
      '【AudioParam 动画化（监听者跟随头部移动）】',
      '  // 用 linearRampToValueAtTime 让监听者平滑移动',
      '  const t = ctx.currentTime;',
      '  listener.positionX.setValueAtTime(0, t);',
      '  listener.positionX.linearRampToValueAtTime(5, t + 2);  // 2 秒内右移 5 单位',
      '  // 或在 WebXR requestAnimationFrame 中实时同步头部姿态',
      '',
      '【BaseAudioContext.listener 只读属性】',
      '  // AudioContext 与 OfflineAudioContext 均继承 BaseAudioContext',
      '  // listener 在 ctx 创建时自动生成，无需 new',
      '  console.log(ctx.listener instanceof AudioListener);  // true（真实浏览器）',
      '',
      '【坐标系约定】',
      '  - 右手坐标系：+X 右、+Y 上、+Z 朝向观察者（声音从屏幕外传来）',
      '  - forward 默认 (0,0,-1)：听者朝 -Z 看（声音在前方）',
      '  - up 默认 (0,1,0)：头顶朝 +Y',
      '  - PannerNode.positionZ 为负 → 声源在前方（屏幕内）',
      '',
      '【与 StereoPannerNode 的区别】',
      '  StereoPannerNode：仅左右声像（pan -1~+1），无距离/朝向，2D 简化',
      '  PannerNode + AudioListener：完整 3D 空间化（位置 + 朝向 + 距离衰减 + 声锥）',
      liveResult,
    ].join('\n');
    this.setState({ listenerInfo: info });
    this._addLog('audio', 'AudioListener 演示完成：监听者 9 个 AudioParam 已说明');
  }

  // ===================== Card 2：PannerNode 基础 =====================

  _runPannerBasicDemo() {
    const f = this._flags();
    let liveResult = '';
    if (f.audioContext && f.pannerNode) {
      const ctx = this._ensureCtx();
      if (ctx) {
        try {
          const panner = new PannerNode(ctx, {
            panningModel: 'HRTF',
            distanceModel: 'inverse',
            positionX: 5,
            positionZ: -10,
          });
          this._track(panner);
          liveResult = [
            '',
            '【实际 PannerNode 构造检测】',
            `  new PannerNode(ctx, { panningModel: 'HRTF', positionX: 5, positionZ: -10 }) ✓`,
            `  panner.panningModel = "${panner.panningModel}"`,
            `  panner.distanceModel = "${panner.distanceModel}"`,
            `  panner.positionX.value = ${panner.positionX.value}`,
            `  panner.positionZ.value = ${panner.positionZ.value}`,
            `  panner.refDistance = ${panner.refDistance}`,
            `  panner.maxDistance = ${panner.maxDistance}`,
            `  panner.rolloffFactor = ${panner.rolloffFactor}`,
          ].join('\n');
          this._addLog('audio', `new PannerNode ✓ panningModel=${panner.panningModel} distanceModel=${panner.distanceModel}`);
        } catch (err: any) {
          this._addLog('warn', `PannerNode 构造失败：${err && err.message}`);
        }
      }
    } else {
      this._addLog('warn', 'PannerNode 不可用，跳过真实构造（jsdom 无 PannerNode）');
    }

    const info = [
      '===== PannerNode 基础：构造与 panningModel =====',
      '',
      '【PannerNode —— 3D 空间化声源节点】',
      '  // 构造（推荐直接传 options）',
      '  const panner = new PannerNode(ctx, {',
      '    panningModel: "HRTF",        // 空间化算法',
      '    distanceModel: "inverse",    // 距离衰减模型',
      '    positionX: 5,                // 声源 X 坐标',
      '    positionY: 0,',
      '    positionZ: -10,              // 声源 Z 坐标（前方）',
      '    orientationX: 1,             // 声源朝向（指向性声源）',
      '    orientationY: 0,',
      '    orientationZ: 0,',
      '    refDistance: 1,             // 参考距离',
      '    maxDistance: 10000,          // 最大距离',
      '    rolloffFactor: 1,           // 衰减速率',
      '    coneInnerAngle: 360,        // 声锥内角',
      '    coneOuterAngle: 360,        // 声锥外角',
      '    coneOuterGain: 0,           // 声锥外增益',
      '  });',
      '',
      '  // 连接拓扑：Source → PannerNode → destination',
      '  oscillator.connect(panner).connect(ctx.destination);',
      '',
      '【panningModel —— 空间化算法（核心）】',
      '  panner.panningModel = "equalpower";  // 或 "HRTF"',
      '',
      '  1. equalpower（等功率）',
      '     - 简单左右声道能量分配（基于方位角的 sin/cos）',
      '     - 计算量小，CPU 占用低',
      '     - 无 HRTF 频域处理，定位感弱，无前后区分',
      '     - 适合大量声源 / 移动端 / 低性能设备',
      '',
      '  2. HRTF（Head-Related Transfer Function，头相关传递函数）',
      '     - 基于人头测量数据的频域卷积，模拟双耳听音',
      '     - 双耳渲染（Binaural Rendering），定位感强，可分辨前后/上下',
      '     - 计算量大，CPU 占用高（每个 PannerNode 都做卷积）',
      '     - 适合高质量沉浸式体验（VR/AR/游戏）',
      '',
      '【HRTF vs equalpower 性能对比】',
      '  指标           equalpower        HRTF',
      '  算法           左右能量分配       频域 HRTF 卷积',
      '  CPU 开销       ~1x               ~5-10x',
      '  定位精度       左右模糊           前后上下清晰',
      '  前后区分       ✗ 无               ✓ 有',
      '  适合数量       数百个             ~32-64 个',
      '  适用场景       大量环境音         VR/AR 沉浸式',
      '',
      '【动态切换 panningModel】',
      '  panner.panningModel = "HRTF";   // 可运行时切换',
      '  // 切换会重新初始化内部 HRTF 卷积器，短暂卡顿可能',
      '',
      '【PannerNode 默认值】',
      '  panningModel      "equalpower"   distanceModel   "inverse"',
      '  refDistance        1              maxDistance     3.4028e+38',
      '  rolloffFactor      1              coneInnerAngle  360',
      '  coneOuterAngle     360            coneOuterGain   0',
      '  channelCount       2              channelCountMode "clamped-max"',
      liveResult,
    ].join('\n');
    this.setState({ pannerBasicInfo: info });
    this._addLog('audio', `PannerNode 基础演示完成：panningModel ∈ {${PANNING_MODELS.join(', ')}}`);
  }

  // ===================== Card 3：声源位置与朝向 =====================

  _runPositionDemo() {
    const f = this._flags();
    let liveResult = '';
    if (f.audioContext && f.pannerNode) {
      const ctx = this._ensureCtx();
      if (ctx) {
        try {
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          const osc = new OscillatorNode(ctx, { type: 'sine', frequency: 440 });
          const gain = new GainNode(ctx, { gain: 0.18 });
          const panner = new PannerNode(ctx, {
            panningModel: 'HRTF',
            positionX: 8,
            positionZ: -10,
          });
          osc.connect(gain).connect(panner).connect(ctx.destination);
          osc.start();
          this._trackOsc(osc);
          this._track(panner);
          this._track(gain);
          // 用 requestAnimationFrame 让声源绕听者旋转
          const t0 = ctx.currentTime;
          const sourceEl = (this.$('.spatial-source') as any);
          const tick = () => {
            const t = ctx.currentTime - t0;
            const x = Math.sin(t * 1.2) * 8;
            const z = -10 - Math.cos(t * 1.2) * 4;
            try {
              panner.positionX.value = x;
              panner.positionZ.value = z;
            } catch { /* noop */ }
            // 同步可视化小球位置（场景宽 200px，半宽 100px）
            if (sourceEl) {
              sourceEl.style.left = `${50 + (x / 16) * 50}%`;
              sourceEl.style.top = `${50 + (z / 20) * 50 + 25}%`;
            }
            this._pannerRaf = requestAnimationFrame(tick);
          };
          this._pannerRaf = requestAnimationFrame(tick);
          // 6 秒后自动停止
          const timer = setTimeout(() => {
            try { osc.stop(); } catch { /* noop */ }
            try { osc.disconnect(); panner.disconnect(); gain.disconnect(); } catch { /* noop */ }
            if (this._pannerRaf) {
              cancelAnimationFrame(this._pannerRaf);
              this._pannerRaf = null;
            }
            this._addLog('info', '声源旋转动画已停止（6s 超时）');
          }, 6000);
          this._stopTimers.push(timer);
          liveResult = [
            '',
            '【实际动画演示】',
            '  已启动：440Hz 正弦波 → GainNode(0.18) → PannerNode(HRTF) → destination',
            '  requestAnimationFrame 中实时更新 positionX/Z',
            '  声源沿椭圆轨迹绕听者旋转（持续 6 秒）',
            '  耳机体验：能听到声音从右前方→正前→左前方→后方旋转',
          ].join('\n');
          this._addLog('audio', 'PannerNode 位置动画已启动（绕头旋转，6s）');
        } catch (err: any) {
          this._addLog('warn', `PannerNode 动画失败：${err && err.message}`);
        }
      }
    } else {
      this._addLog('warn', 'AudioContext/PannerNode 不可用，跳过真实动画（jsdom 无 Web Audio）');
      liveResult = [
        '',
        '【动画演示跳过】',
        '  jsdom 环境无 AudioContext/PannerNode，无法创建真实声源',
        '  真实浏览器点击本按钮可听到 440Hz 声源绕头旋转',
        '  建议佩戴耳机体验 HRTF 双耳渲染效果',
      ].join('\n');
    }

    const info = [
      '===== 声源位置与朝向：positionX/Y/Z + orientationX/Y/Z =====',
      '',
      '【positionX/Y/Z —— 声源世界坐标（AudioParam）】',
      '  const panner = new PannerNode(ctx, { panningModel: "HRTF" });',
      '  // 设置声源位置（默认 (0,0,0)）',
      '  panner.positionX.value = 5;    // 声源在听者右侧 5 单位',
      '  panner.positionY.value = 0;    // 同高',
      '  panner.positionZ.value = -10;  // 声源在前方 10 单位',
      '',
      '  // 旧版 setPosition 方法（已废弃，推荐用 AudioParam）',
      '  panner.setPosition(5, 0, -10);',
      '',
      '【orientationX/Y/Z —— 声源朝向（指向性声源）】',
      '  // 声源本身有朝向（如喇叭朝前），影响声锥方向',
      '  panner.orientationX.value = 1;  // 声源朝 +X 方向辐射',
      '  panner.orientationY.value = 0;',
      '  panner.orientationZ.value = 0;',
      '  // 旧版 setOrientation 方法（已废弃）',
      '  panner.setOrientation(1, 0, 0);',
      '',
      '【AudioParam 自动化（声源平滑移动）】',
      '  const t = ctx.currentTime;',
      '  // linearRamp：声源 2 秒内从 (0,0,-10) 移到 (5,0,-10)',
      '  panner.positionX.setValueAtTime(0, t);',
      '  panner.positionX.linearRampToValueAtTime(5, t + 2);',
      '',
      '  // exponentialRamp：声源距离指数变化',
      '  panner.positionZ.setValueAtTime(-5, t);',
      '  panner.positionZ.exponentialRampToValueAtTime(-30, t + 3);',
      '',
      '  // setValueCurveAtTime：自定义轨迹曲线',
      '  const xs = new Float32Array([0, 5, 0, -5, 0]);',
      '  panner.positionX.setValueCurveAtTime(xs, t, 4);',
      '',
      '【requestAnimationFrame 实时动画（推荐）】',
      '  // 游戏中声源位置变化用 RAF 同步更新（更平滑）',
      '  function animate() {',
      '    const t = ctx.currentTime - t0;',
      '    panner.positionX.value = Math.sin(t) * 8;     // 左右摆动',
      '    panner.positionZ.value = -10 - Math.cos(t) * 4; // 前后移动',
      '    requestAnimationFrame(animate);',
      '  }',
      '  animate();',
      '',
      '【与监听者坐标系的关系】',
      '  声源相对监听者的方位/距离决定 HRTF 卷积参数',
      '  声源在听者左前方 → 左耳先听到 + 左耳音量大（ITD + ILD）',
      '  声源在听者后方 → 高频衰减 + 双耳差异小（HRTF 后向特征）',
      '',
      '【位置更新性能】',
      '  - AudioParam.value = x：直接赋值，无平滑，可能产生爆音',
      '  - setTargetAtTime：平滑过渡，避免阶跃爆音',
      '    panner.positionX.setTargetAtTime(x, ctx.currentTime, 0.05);',
      '  - 大量 PannerNode 同时更新位置时，优先用 setValueCurveAtTime 批量调度',
      liveResult,
    ].join('\n');
    this.setState({ positionInfo: info });
    this._addLog('audio', '声源位置与朝向演示完成：positionX/Y/Z + orientationX/Y/Z + AudioParam 自动化');
  }

  // ===================== Card 4：距离衰减 =====================

  _runDistanceDemo() {
    const f = this._flags();
    let liveResult = '';
    if (f.audioContext && f.pannerNode) {
      const ctx = this._ensureCtx();
      if (ctx) {
        try {
          const panner = new PannerNode(ctx, {
            panningModel: 'equalpower',
            distanceModel: 'inverse',
            refDistance: 1,
            maxDistance: 100,
            rolloffFactor: 1,
            positionZ: -5,
          });
          this._track(panner);
          const models = ['linear', 'inverse', 'exponential'];
          const results = models.map((m: any) => {
            try {
              panner.distanceModel = m;
              return `${m}: ✓ (ref=${panner.refDistance}, max=${panner.maxDistance}, rolloff=${panner.rolloffFactor})`;
            } catch (err: any) {
              return `${m}: ✗ ${err && err.message}`;
            }
          });
          liveResult = [
            '',
            '【实际 distanceModel 切换检测】',
            ...results.map((r: any) => `  ${r}`),
          ].join('\n');
          this._addLog('audio', `distanceModel 切换测试：${models.join(' / ')}`);
        } catch (err: any) {
          this._addLog('warn', `距离衰减检测失败：${err && err.message}`);
        }
      }
    } else {
      this._addLog('warn', 'PannerNode 不可用，跳过距离衰减真实检测（jsdom 无 PannerNode）');
    }

    const info = [
      '===== 距离衰减：distanceModel + refDistance/maxDistance/rolloffFactor =====',
      '',
      '【距离衰减公式】声源音量随距离增大而衰减（模拟真实物理）',
      '  PannerNode 提供三种 distanceModel：',
      '',
      '  1. linear（线性衰减）',
      '     gain = (1 - (d - ref) / (max - ref)) * rolloff',
      '     在 refDistance 内全音量，maxDistance 外静音，之间线性',
      '     注意：物理上不真实，但简单可控，被废弃建议但仍可用',
      '     panner.distanceModel = "linear";',
      '',
      '  2. inverse（反比衰减，默认）',
      '     gain = ref / (ref + rolloff * (d - ref))',
      '     在 refDistance 内全音量，之后按 1/r 反比衰减',
      '     物理真实（点声源球面发散），推荐使用',
      '     panner.distanceModel = "inverse";',
      '',
      '  3. exponential（指数衰减）',
      '     gain = pow(d / ref, -rolloff)',
      '     按 (d/ref)^(-rolloff) 衰减，更陡峭',
      '     适合需要快速衰减的场景',
      '     panner.distanceModel = "exponential";',
      '',
      '【refDistance —— 参考距离】',
      '  // 在该距离内声源不衰减（全音量），超出后开始衰减',
      '  panner.refDistance = 1;   // 默认 1',
      '  // 通常设为声源"贴近耳朵"的距离（如 1 米）',
      '',
      '【maxDistance —— 最大距离】',
      '  // 超过该距离后音量固定不再衰减（linear 模型下直接静音）',
      '  panner.maxDistance = 10000;  // 默认 3.4028e+38（几乎无限）',
      '  // 建议根据场景范围设置（如房间 50 米、战场 500 米）',
      '',
      '【rolloffFactor —— 衰减速率】',
      '  // 控制衰减快慢，越大衰减越快',
      '  panner.rolloffFactor = 1;     // 默认 1（标准衰减）',
      '  panner.rolloffFactor = 2;     // 衰减更快（声音更"近"）',
      '  panner.rolloffFactor = 0.5;   // 衰减更慢（声音传播更远）',
      '  // linear 模型下 rolloffFactor 限制为 [0, 1]',
      '  // inverse/exponential 模型下 rolloffFactor 可大于 1',
      '',
      '【三种模型对比示例】',
      '  // 声源距离 d=10，refDistance=1，maxDistance=100，rolloffFactor=1',
      '  //   linear:       gain ≈ (1 - 9/99) ≈ 0.909',
      '  //   inverse:      gain = 1 / (1 + 1*9) = 0.1',
      '  //   exponential:  gain = (10/1)^-1 = 0.1',
      '',
      '【代码示例：完整距离衰减配置】',
      '  const panner = new PannerNode(ctx, {',
      '    panningModel: "HRTF",',
      '    distanceModel: "inverse",',
      '    refDistance: 1,',
      '    maxDistance: 50,',
      '    rolloffFactor: 1.5,',
      '    positionZ: -10,',
      '  });',
      '  oscillator.connect(panner).connect(ctx.destination);',
      '',
      '【动态改变衰减参数】',
      '  panner.rolloffFactor = 3;  // 运行时增大衰减速率',
      '  // 参数变化立即生效，无需重新连接',
      liveResult,
    ].join('\n');
    this.setState({ distanceInfo: info });
    this._addLog('audio', `距离衰减演示完成：distanceModel ∈ {${DISTANCE_MODELS.join(', ')}}`);
  }

  // ===================== Card 5：声锥与立体声 =====================

  _runConeDemo() {
    const f = this._flags();
    let liveResult = '';
    if (f.audioContext && f.pannerNode) {
      const ctx = this._ensureCtx();
      if (ctx) {
        try {
          const panner = new PannerNode(ctx, {
            panningModel: 'equalpower',
            coneInnerAngle: 60,
            coneOuterAngle: 180,
            coneOuterGain: 0.3,
            orientationX: 0,
            orientationZ: -1,
          });
          this._track(panner);
          liveResult = [
            '',
            '【实际声锥参数检测】',
            `  coneInnerAngle = ${panner.coneInnerAngle}°`,
            `  coneOuterAngle = ${panner.coneOuterAngle}°`,
            `  coneOuterGain = ${panner.coneOuterGain}`,
            `  orientationX = ${panner.orientationX.value}`,
            `  orientationZ = ${panner.orientationZ.value}`,
          ].join('\n');
          this._addLog('audio', `声锥参数：inner=${panner.coneInnerAngle}° outer=${panner.coneOuterAngle}° outerGain=${panner.coneOuterGain}`);
        } catch (err: any) {
          this._addLog('warn', `声锥检测失败：${err && err.message}`);
        }
      }
    } else {
      this._addLog('warn', 'PannerNode 不可用，跳过声锥真实检测（jsdom 无 PannerNode）');
    }
    if (f.audioContext && f.stereoPannerNode) {
      const ctx = this._ensureCtx();
      if (ctx) {
        try {
          const sp = new StereoPannerNode(ctx, { pan: 0 });
          this._track(sp);
          this._addLog('audio', `new StereoPannerNode ✓ pan=${sp.pan.value} channelCount=${sp.channelCount}`);
        } catch (err: any) {
          this._addLog('warn', `StereoPannerNode 检测失败：${err && err.message}`);
        }
      }
    } else {
      this._addLog('warn', 'StereoPannerNode 不可用，跳过真实检测');
    }

    const info = [
      '===== 声锥与立体声：cone* + StereoPannerNode + channelCount =====',
      '',
      '【声锥（Sound Cone）—— 指向性声源】',
      '  // 声源本身有朝向时，声音在不同角度衰减不同（如喇叭/枪声）',
      '  panner.coneInnerAngle = 60;    // 内锥角（度），全音量',
      '  panner.coneOuterAngle = 180;   // 外锥角（度），衰减到 coneOuterGain',
      '  panner.coneOuterGain = 0.3;    // 外锥外音量（0-1）',
      '  panner.orientationX.value = 0;  // 声源朝 -Z 方向辐射',
      '  panner.orientationZ.value = -1;',
      '',
      '【声锥几何】',
      '  声源 → orientation 朝向',
      '    内锥（coneInnerAngle 范围内）：全音量',
      '    内外锥之间：从全音量线性插值到 coneOuterGain',
      '    外锥外（coneOuterAngle 之外）：固定 coneOuterGain',
      '  默认 coneInnerAngle=360, coneOuterAngle=360, coneOuterGain=0',
      '  → 360° 全向辐射（无指向性，等同点声源）',
      '',
      '【典型声锥配置】',
      '  // 喇叭朝前的扬声器：',
      '  panner.coneInnerAngle = 90;   // 正前方 90° 全音量',
      '  panner.coneOuterAngle = 270;  // 后方 90° 区域',
      '  panner.coneOuterGain = 0.1;   // 后方衰减到 10%',
      '',
      '  // 全向点声源（默认值，无指向性）：',
      '  panner.coneInnerAngle = 360;',
      '  panner.coneOuterAngle = 360;',
      '  panner.coneOuterGain = 0;',
      '',
      '【StereoPannerNode —— 简易立体声声像】',
      '  // 仅左右声道平衡，无 3D 空间化（2D 简化版）',
      '  const sp = new StereoPannerNode(ctx, { pan: 0 });',
      '  sp.pan.value = -1;  // 全左声道',
      '  sp.pan.value = 0;   // 居中',
      '  sp.pan.value = 1;   // 全右声道',
      '  oscillator.connect(sp).connect(ctx.destination);',
      '',
      '  // pan 是 AudioParam，可动画化',
      '  sp.pan.setValueAtTime(-1, t);',
      '  sp.pan.linearRampToValueAtTime(1, t + 2);  // 2 秒左→右扫频',
      '',
      '【PannerNode vs StereoPannerNode 选择】',
      '  指标        PannerNode              StereoPannerNode',
      '  维度        3D（位置+朝向+距离）     2D（仅左右声像）',
      '  算法        HRTF/equalpower         等功率分配',
      '  距离衰减    ✓ 三种模型              ✗ 无',
      '  声锥        ✓ 指向性                 ✗ 无',
      '  CPU 开销    高（HRTF）              极低',
      '  适用        3D 游戏/VR              音乐播放器/简单声像',
      '',
      '【channelCount —— 声道数】',
      '  // PannerNode 默认 channelCount=2，channelCountMode="clamped-max"',
      '  panner.channelCount = 2;',
      '  // HRTF 模式强制双声道输出（双耳渲染）',
      '  // equalpower 模式下声道数影响计算',
      '',
      '【代码示例：声锥 + 距离衰减组合】',
      '  const panner = new PannerNode(ctx, {',
      '    panningModel: "HRTF",',
      '    distanceModel: "inverse",',
      '    refDistance: 1,',
      '    rolloffFactor: 1,',
      '    coneInnerAngle: 90,',
      '    coneOuterAngle: 270,',
      '    coneOuterGain: 0.1,',
      '    orientationX: 0,',
      '    orientationY: 0,',
      '    orientationZ: -1,  // 朝 -Z 方向辐射',
      '    positionX: 3,',
      '    positionZ: -5,',
      '  });',
      '  oscillator.connect(panner).connect(ctx.destination);',
      liveResult,
    ].join('\n');
    this.setState({ coneInfo: info });
    this._addLog('audio', '声锥与立体声演示完成：cone* + StereoPannerNode + channelCount');
  }

  // ===================== Card 6：WebXR 协同 =====================

  _runWebXRDemo() {
    const f = this._flags();
    let liveResult = '';
    if (f.webxr) {
      try {
        const supported = navigator.xr.isSessionSupported
          ? navigator.xr.isSessionSupported('immersive-vr')
          : Promise.resolve(false);
        Promise.resolve(supported).then((ok: any) => {
          this._addLog('info', `navigator.xr.isSessionSupported("immersive-vr") → ${ok}`);
        }).catch(() => {
          this._addLog('warn', 'isSessionSupported 检测失败');
        });
        liveResult = [
          '',
          '【实际 WebXR 检测】',
          '  navigator.xr 存在：✓',
          '  isSessionSupported("immersive-vr") 已发起（见日志）',
        ].join('\n');
      } catch (err: any) {
        this._addLog('warn', `WebXR 检测失败：${err && err.message}`);
      }
    } else {
      this._addLog('warn', 'WebXR 不可用（navigator.xr 缺失），跳过头部跟踪演示');
      liveResult = [
        '',
        '【WebXR 检测跳过】',
        '  navigator.xr 不存在（jsdom 或非 HTTPS/无 XR 设备）',
        '  真实 WebXR 环境需：HTTPS + XR 兼容设备 + 用户手势请求 session',
      ].join('\n');
    }

    const info = [
      '===== WebXR 协同：AudioListener 与 WebXR 同步 + 头部跟踪 =====',
      '',
      '【核心思路：用 WebXR 头部姿态驱动 AudioListener】',
      '  // WebXR 提供头部位置与朝向（XRRigidTransform）',
      '  // 每帧将 XR 姿态写入 AudioListener 的 9 个 AudioParam',
      '  // 实现"听者转头 → 声源方位跟随变化"的沉浸式体验',
      '',
      '【navigator.xr 能力检测】',
      '  if ("xr" in navigator) {',
      '    const supported = await navigator.xr.isSessionSupported("immersive-vr");',
      '    if (supported) {',
      '      const session = await navigator.xr.requestSession("immersive-vr", {',
      '        optionalFeatures: ["local-floor"],',
      '      });',
      '      // 建立 WebGLXR 渲染层',
      '      const gl = canvas.getContext("webgl", { xrCompatible: true });',
      '      await gl.makeXRCompatible();',
      '      session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });',
      '    }',
      '  }',
      '',
      '【requestAnimationFrame 同步头部姿态】',
      '  let xrRefSpace = null;',
      '  session.requestReferenceSpace("local-floor").then((rs: any) => {',
      '    xrRefSpace = rs;',
      '    session.requestAnimationFrame(onXRFrame);',
      '  });',
      '',
      '  function onXRFrame(time, frame) {',
      '    const pose = frame.getViewerPose(xrRefSpace);',
      '    if (pose) {',
      '      // XRRigidTransform 提供位置 + 朝向（quaternion）',
      '      const pos = pose.transform.position;     // DOMPointReadOnly',
      '      const ori = pose.transform.orientation;   // 四元数 (x,y,z,w)',
      '',
      '      // 1. 位置同步',
      '      listener.positionX.value = pos.x;',
      '      listener.positionY.value = pos.y;',
      '      listener.positionZ.value = pos.z;',
      '',
      '      // 2. 朝向同步（四元数 → forward/up 向量）',
      '      const { forward, up } = quatToVectors(ori);',
      '      listener.forwardX.value = forward.x;',
      '      listener.forwardY.value = forward.y;',
      '      listener.forwardZ.value = forward.z;',
      '      listener.upX.value = up.x;',
      '      listener.upY.value = up.y;',
      '      listener.upZ.value = up.z;',
      '    }',
      '    session.requestAnimationFrame(onXRFrame);',
      '  }',
      '',
      '【四元数 → forward/up 向量转换】',
      '  // XRRigidTransform.orientation 是四元数 (x,y,z,w)',
      '  function quatToVectors(q) {',
      '    // forward = quat * (0,0,-1)',
      '    const fx = -2 * (q.x * q.z + q.w * q.y);',
      '    const fy = -2 * (q.y * q.z - q.w * q.x);',
      '    const fz = -(1 - 2 * (q.x * q.x + q.y * q.y));',
      '    // up = quat * (0,1,0)',
      '    const ux = 2 * (q.x * q.y - q.w * q.z);',
      '    const uy = 1 - 2 * (q.x * q.x + q.z * q.z);',
      '    const uz = 2 * (q.y * q.z + q.w * q.x);',
      '    return {',
      '      forward: { x: fx, y: fy, z: fz },',
      '      up: { x: ux, y: uy, z: uz },',
      '    };',
      '  }',
      '',
      '【WebXR space 与 Web Audio 协同】',
      '  - XR 坐标系：local-floor（地面为原点，Y 向上）',
      '  - Web Audio 坐标系：右手系，Y 向上，与 XR 一致',
      '  - 声源位置也在 XR 参考空间中（同一坐标系）',
      '  - 多个 PannerNode 共享同一个 listener（context.listener）',
      '',
      '【沉浸式音频会话特性】',
      '  // WebXR 沉浸模式可能要求音频空间化上下文',
      '  const ctx = new AudioContext({',
      '    latencyHint: "interactive",',
      '    // 沉浸式 VR 推荐低延迟',
      '  });',
      '  // 在 immersive-vr session 中，浏览器可能自动应用 HRTF',
      '',
      '【降级方案（无 WebXR 环境）】',
      '  - 用 DeviceOrientationEvent + 加速度计做近似头部跟踪',
      '  - window.addEventListener($1, (e: any) => {',
      '      // e.alpha / e.beta / e.gamma → 欧拉角 → 转四元数 → 写入 listener',
      '    });',
      '  - 仅水平面旋转（无俯仰），但移动端可用',
      liveResult,
    ].join('\n');
    this.setState({ webxrInfo: info });
    this._addLog('audio', 'WebXR 协同演示完成：头部跟踪 + XRRigidTransform 转换');
  }

  // ===================== Card 7：多声道与 Ambisonics =====================

  _runMultichannelDemo() {
    const f = this._flags();
    let liveResult = '';
    if (f.audioContext) {
      const ctx = this._ensureCtx();
      if (ctx) {
        try {
          if (f.channelMergerNode) {
            const merger = new ChannelMergerNode(ctx, { numberOfInputs: 6 });
            this._track(merger);
          }
          if (f.channelSplitterNode) {
            const splitter = new ChannelSplitterNode(ctx, { numberOfOutputs: 6 });
            this._track(splitter);
          }
          liveResult = [
            '',
            '【实际多声道节点检测】',
            `  ChannelMergerNode：${f.channelMergerNode ? '✓ 可构造' : '✗ 不可用'}`,
            `  ChannelSplitterNode：${f.channelSplitterNode ? '✓ 可构造' : '✗ 不可用'}`,
            `  MediaElementAudioSourceNode：${f.mediaElementAudioSourceNode ? '✓ 可构造' : '✗ 不可用'}`,
            `  ctx.destination.maxChannelCount = ${ctx.destination.maxChannelCount}`,
            `  ctx.destination.channelCount = ${ctx.destination.channelCount}`,
          ].join('\n');
          this._addLog('audio', `多声道检测：merger=${f.channelMergerNode} splitter=${f.channelSplitterNode} dest.maxChannelCount=${ctx.destination.maxChannelCount}`);
        } catch (err: any) {
          this._addLog('warn', `多声道检测失败：${err && err.message}`);
        }
      }
    } else {
      this._addLog('warn', 'AudioContext 不可用，跳过多声道真实检测（jsdom 无 Web Audio）');
    }

    const info = [
      '===== 多声道与 Ambisonics：ChannelMerger/Splitter + MediaElement + Ambisonics =====',
      '',
      '【ChannelMergerNode —— 多路合并为多声道】',
      '  // 将多个单声道输入合并为一个多声道信号',
      '  const merger = new ChannelMergerNode(ctx, { numberOfInputs: 6 });',
      '  // 6 个单声道源分别接入 merger 的 6 个输入',
      '  src0.connect(merger, 0, 0);  // → 第 1 声道',
      '  src1.connect(merger, 0, 1);  // → 第 2 声道',
      '  src2.connect(merger, 0, 2);  // → 第 3 声道',
      '  // ... 第 4/5/6 声道（5.1 环绕）',
      '  merger.connect(ctx.destination);',
      '',
      '【ChannelSplitterNode —— 多声道拆分为单路】',
      '  // 将多声道信号拆分为多个单声道输出',
      '  const splitter = new ChannelSplitterNode(ctx, { numberOfOutputs: 6 });',
      '  source.connect(splitter);',
      '  splitter.connect(ctx.destination, 0);  // 第 1 声道 → 输出',
      '  splitter.connect(analyser1, 1);        // 第 2 声道 → 分析',
      '  splitter.connect(gainNode, 2);         // 第 3 声道 → 增益',
      '',
      '【MediaElementAudioSourceNode —— 视频空间化】',
      '  // 把 <video>/<audio> 元素接入 Web Audio 图进行空间化处理',
      '  const video = document.querySelector("video");',
      '  const srcNode = new MediaElementAudioSourceNode(ctx, {',
      '    mediaElement: video,',
      '  });',
      '  const panner = new PannerNode(ctx, { panningModel: "HRTF" });',
      '  panner.positionX.value = 5;',
      '  panner.positionZ.value = -3;',
      '  srcNode.connect(panner).connect(ctx.destination);',
      '  // 视频声音现在从右侧 5 单位、前方 3 单位传来',
      '',
      '【5.1 环绕声示例（6 声道）】',
      '  // 标准 5.1：左/中/右/低音/左环绕/右环绕',
      '  const channels = ["L", "R", "C", "LFE", "LS", "RS"];',
      '  const merger = new ChannelMergerNode(ctx, { numberOfInputs: 6 });',
      '  channels.forEach((_: any, i: number) => {',
      '    const osc = new OscillatorNode(ctx, { frequency: 200 + i * 100 });',
      '    osc.connect(merger, 0, i);',
      '    osc.start();',
      '  });',
      '  merger.connect(ctx.destination);',
      '  // 需 destination.maxChannelCount >= 6（部分设备仅支持 2 声道）',
      '',
      '【Ambisonics —— 高阶环绕声（HOA）】',
      '  // Ambisonics：球谐函数编码的全景声，可旋转解码',
      '  // 一阶 Ambisonics（FOA）：4 声道 W/X/Y/Z',
      '  //   W：全向（压力）',
      '  //   X/Y/Z：前后/左右/上下梯度',
      '  // 高阶（二阶/三阶）：9/16 声道，精度更高',
      '',
      '  // Ambisonics 工作流：',
      '  //   1. 声源编码为 Ambisonics 域信号（B-format）',
      '  //   2. 任意旋转（头部跟踪时只需旋转 B-format）',
      '  //   3. 解码为双耳/环绕（HRTF 卷积或扬声器）',
      '',
      '  // Web Audio 实现 Ambisonics（手动卷积）',
      '  const ambisonicChannels = 4;  // FOA',
      '  const splitter = new ChannelSplitterNode(ctx, { numberOfOutputs: ambisonicChannels });',
      '  // B-format → 4 个 ConvolverNode 做 HRTF 卷积 → 4 路合并为双耳',
      '  const wHRIR = loadHRIR("W");  // 加载头相关脉冲响应',
      '  const convW = new ConvolverNode(ctx, { buffer: wHRIR });',
      '  // ... X/Y/Z 各做一个卷积',
      '',
      '【与 PannerNode 的关系】',
      '  - PannerNode：单声源空间化，每个声源一个节点',
      '  - Ambisonics：场景级空间化，多声源编码后整体旋转',
      '  - 大量声源 + 头部跟踪：Ambisonics 更高效（旋转矩阵而非每源 HRTF）',
      '  - 少量声源：PannerNode 更简单',
      '',
      '【浏览器支持】',
      '  - AudioContext.destination.maxChannelCount：',
      '    Chrome/Edge 通常 2（耳机）/6（5.1 设备）',
      '    Firefox 支持多声道输出',
      '  - MediaElementAudioSourceNode：全主流浏览器支持',
      '  - ConvolverNode（HRTF 卷积）：全支持，但需加载 HRIR',
      liveResult,
    ].join('\n');
    this.setState({ multichannelInfo: info });
    this._addLog('audio', '多声道与 Ambisonics 演示完成：ChannelMerger/Splitter + MediaElement + Ambisonics');
  }

  // ===================== Card 8：性能与生态 =====================

  _runPerfDemo() {
    const f = this._flags();
    let liveResult = '';
    if (f.audioContext && f.pannerNode) {
      const ctx = this._ensureCtx();
      if (ctx) {
        try {
          // 测试 HRTF vs equalpower 构造与切换开销
          const panner = new PannerNode(ctx, { panningModel: 'equalpower' });
          this._track(panner);
          const t0 = performance.now();
          panner.panningModel = 'HRTF';
          const t1 = performance.now();
          panner.panningModel = 'equalpower';
          const t2 = performance.now();
          liveResult = [
            '',
            '【实际性能微基准】',
            `  equalpower → HRTF 切换：${(t1 - t0).toFixed(3)}ms`,
            `  HRTF → equalpower 切换：${(t2 - t1).toFixed(3)}ms`,
            `  ctx.sampleRate = ${ctx.sampleRate}`,
            `  ctx.baseLatency = ${(ctx.baseLatency ?? 0).toFixed(5)}s`,
            '  （注：HRTF 切换会重建卷积器，首次切换开销较大）',
          ].join('\n');
          this._addLog('audio', `性能微基准：HRTF 切换 ${((t1 - t0)).toFixed(3)}ms`);
        } catch (err: any) {
          this._addLog('warn', `性能检测失败：${err && err.message}`);
        }
      }
    } else {
      this._addLog('warn', 'PannerNode 不可用，跳过性能真实检测（jsdom 无 Web Audio）');
    }

    const info = [
      '===== 性能与生态：HRTF 开销 + 数量上限 + AudioWorklet + ResonanceAudio =====',
      '',
      '【HRTF vs equalpower CPU 开销】',
      '  指标              equalpower        HRTF',
      '  单 PannerNode     ~0.01% CPU        ~0.05-0.1% CPU',
      '  算法              左右能量分配       频域 HRTF 卷积',
      '  内存              极低              每个节点维护卷积缓冲',
      '  首次切换开销      极低              高（重建卷积器）',
      '  推荐数量          数百个            ~32-64 个',
      '  推荐场景          大量环境音         VR/AR 沉浸式',
      '',
      '【PannerNode 数量上限经验值】',
      '  - 桌面 Chrome + HRTF：流畅 ~32 个，~64 个仍可用',
      '  - 移动端 HRTF：~16 个，超过帧率下降',
      '  - equalpower：可达数百个',
      '  - 大量声源建议：用 Ambisonics 编码（场景级一次 HRTF）',
      '',
      '【AudioWorklet 自定义 HRTF 卷积】',
      '  // 标准 PannerNode 用内置 HRTF 数据集，不可定制',
      '  // AudioWorklet 可实现自定义 HRTF 卷积（如个性化测量数据）',
      '  class HRTFProcessor extends AudioWorkletProcessor {',
      '    process(inputs: any, outputs: any){',
      '      const input = inputs[0];',
      '      const output = outputs[0];',
      '      // 用个性化 HRIR（头相关脉冲响应）做卷积',
      '      // 输入：单声道声源 + 方位元数据',
      '      // 输出：双耳立体声',
      '      for (let c = 0; c < output.length; c++) {',
      '        const out = output[c];',
      '        const inCh = input[0] || input[c];',
      '        for (let i = 0; i < out.length; i++) {',
      '          out[i] = convolve(inCh, this.hrir[c], i);',
      '        }',
      '      }',
      '      return true;',
      '    }',
      '  }',
      '  registerProcessor("hrtf-processor", HRTFProcessor);',
      '',
      '  // 主线程加载 + 使用',
      '  await ctx.audioWorklet.addModule("hrtf-processor.js");',
      '  const hrtfNode = new AudioWorkletNode(ctx, "hrtf-processor");',
      '  oscillator.connect(hrtfNode).connect(ctx.destination);',
      '',
      '【ResonanceAudio 集成（Google 高阶空间音频库）】',
      '  // ResonanceAudio：基于 Web Audio 的高质量空间音频库',
      '  //   - 自实现 HRTF 卷积（绕过 PannerNode 限制）',
      '  //   - 房间声学（混响/反射/遮挡）',
      '  //   - 可选个性化 HRTF',
      '',
      '  // 引入：',
      '  //   <script src="resonance-audio.min.js"></script>',
      '  // 或 npm: import ResonanceAudio from "resonance-audio";',
      '',
      '  const scene = new ResonanceAudio(ctx, {',
      '    ambisonicOrder: 3,            // 三阶 Ambisonics（16 声道）',
      '    listenerPosition: [0, 0, 0],',
      '    roomDimensions: { width: 8, height: 4, depth: 8 },',
      '    roomMaterials: {',
      '      // 六面吸声系数（0-1）',
      '      left: "brickbare", right: "brickbare",',
      '      front: "brickbare", back: "brickbare",',
      '      up: "brickbare", down: "woodpanel",',
      '    },',
      '  });',
      '  scene.output.connect(ctx.destination);',
      '',
      '  // 创建声源（带房间反射）',
      '  const source = scene.createSource({',
      '    position: [3, 0, -2],',
      '    forward: [0, 0, -1],',
      '    // 声源属性',
      '    gain: 1,',
      '    minDistance: 1,',
      '    maxDistance: 30,',
      '    rolloff: 1,',
      '    directivity: 0,    // 0=全向，1=完全指向',
      '  });',
      '  oscillator.connect(source.input);',
      '',
      '  // 头部跟踪时只需更新 listenerPosition/Rotation',
      '  scene.setListenerPosition([x, y, z]);',
      '  scene.setListenerRotation(forward, up);',
      '',
      '【浏览器支持矩阵（空间音频相关）】',
      '  浏览器          AudioContext    PannerNode    HRTF    StereoPanner    WebXR',
      '  Chrome 90+      ✓               ✓             ✓       ✓               ✓',
      '  Edge 90+        ✓               ✓             ✓       ✓               ✓',
      '  Firefox 90+     ✓               ✓             ✓       ✓               部分',
      '  Safari 15+      ✓               ✓             ✓       ✓(14+)          ✓(visionOS)',
      '  移动 Chrome     ✓               ✓             ✓       ✓               部分',
      '  移动 Safari     ✓               ✓             ✓       ✓(14.5+)        部分',
      '',
      '【性能优化建议】',
      '  1. 静态声源用 equalpower，关键声源用 HRTF',
      '  2. 超出 maxDistance 的声源断开连接（避免无效计算）',
      '  3. 用 ChannelMergerNode 合并后单次 HRTF（Ambisonics）',
      '  4. AudioWorklet 替代 PannerNode 做个性化 HRTF',
      '  5. 移动端降级为 StereoPannerNode',
      '  6. 监控 ctx.currentTime 与 baseLatency，避免延迟过大',
      '',
      '【生态库一览】',
      '  - ResonanceAudio（Google）：房间声学 + 高阶 Ambisonics',
      '  - THREE.PositionalAudio：Three.js 集成 PannerNode',
      '  - Howler.js：跨浏览器音频封装（含空间化）',
      '  - omnitone：Google Ambisonics 解码器（binaural decoder）',
      '  - sound.js / tone.js：音乐合成（非空间化）',
      liveResult,
    ].join('\n');
    this.setState({ perfInfo: info });
    this._addLog('audio', '性能与生态演示完成：HRTF 开销 + 数量上限 + AudioWorklet + ResonanceAudio');
  }

  // ===================== 渲染 =====================

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概念与 AudioListener —— 空间音频基础与监听者',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['AudioContext', f.audioContext],
          ['AudioListener', f.audioContext],
        ]),
        h(Tag, { color: 'primary' }, '概念'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '空间音频（Spatial Audio）= 3D 定位音频，模拟真实世界中声音随距离/方位/朝向衰减。核心：听者（AudioListener，BaseAudioContext.listener 单例）+ 声源（PannerNode）+ 双耳渲染（HRTF）。AudioListener 有 9 个 AudioParam：positionX/Y/Z（位置）、forwardX/Y/Z（朝向，默认 (0,0,-1)）、upX/Y/Z（头顶，默认 (0,1,0)）。AudioParam 可用 linearRampToValueAtTime 动画化，或 WebXR requestAnimationFrame 实时同步头部姿态。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 AudioListener 演示', { type: 'primary', size: 'sm', onClick: () => this._runListenerDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// BaseAudioContext.listener 只读，每 ctx 一个
const ctx = new AudioContext();
const listener = ctx.listener;

// 9 个 AudioParam（现代浏览器）
listener.positionX.value = 0;       // 监听者 X
listener.positionY.value = 0;
listener.positionZ.value = 0;
listener.forwardX.value = 0;        // 朝向 X
listener.forwardY.value = 0;
listener.forwardZ.value = -1;       // 朝 -Z（前方）
listener.upX.value = 0;             // 头顶 X
listener.upY.value = 1;
listener.upZ.value = 0;

// AudioParam 动画化（监听者平滑移动）
const t = ctx.currentTime;
listener.positionX.setValueAtTime(0, t);
listener.positionX.linearRampToValueAtTime(5, t + 2);

// 旧版（已废弃）：listener.setPosition(x,y,z) / setOrientation(fx,fy,fz,ux,uy,uz)`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.listenerInfo || '（点击按钮查看空间音频概念与 AudioListener 完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. PannerNode 基础 —— 构造与 panningModel（equalpower vs HRTF）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['PannerNode', f.pannerNode],
        ]),
        h(Tag, { color: 'primary' }, '基础'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PannerNode 是 3D 空间化声源节点，构造时传 panningModel/distanceModel/positionXYZ/orientationXYZ/refDistance/maxDistance/rolloffFactor/cone* 等。panningModel 决定空间化算法：equalpower（等功率，CPU 低，无前后区分）vs HRTF（头相关传递函数，双耳渲染，CPU 高 ~5-10x，定位清晰）。connect 拓扑：Source → PannerNode → destination。运行时可动态切换 panningModel。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 PannerNode 基础演示', { type: 'primary', size: 'sm', onClick: () => this._runPannerBasicDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 构造 PannerNode（推荐直接传 options）
const panner = new PannerNode(ctx, {
  panningModel: 'HRTF',        // 'equalpower' | 'HRTF'
  distanceModel: 'inverse',
  positionX: 5, positionY: 0, positionZ: -10,
  orientationX: 1, orientationY: 0, orientationZ: 0,
  refDistance: 1, maxDistance: 10000, rolloffFactor: 1,
  coneInnerAngle: 360, coneOuterAngle: 360, coneOuterGain: 0,
});

// 连接：Source → PannerNode → destination
oscillator.connect(panner).connect(ctx.destination);

// 运行时切换 panningModel
panner.panningModel = 'HRTF';   // 双耳渲染，定位清晰
panner.panningModel = 'equalpower'; // 等功率，CPU 低`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.pannerBasicInfo || '（点击按钮查看 PannerNode 构造与 panningModel 完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. 声源位置与朝向 —— positionX/Y/Z + orientationX/Y/Z + AudioParam 自动化',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['PannerNode', f.pannerNode],
          ['RAF 动画', f.audioContext && typeof requestAnimationFrame === 'function'],
        ]),
        h(Tag, { color: 'primary' }, '动画'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PannerNode.positionX/Y/Z 是声源世界坐标（AudioParam），orientationX/Y/Z 是声源朝向（指向性声源辐射方向）。可用 value 直接赋值、linearRampToValueAtTime 平滑过渡、setValueCurveAtTime 自定义轨迹曲线，或 requestAnimationFrame 实时更新（游戏中声源跟随物体）。下方场景可视化声源绕听者旋转（戴耳机体验 HRTF 双耳渲染）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('启动声源旋转动画', { type: 'primary', size: 'sm', onClick: () => this._runPositionDemo() }),
        ),
        h('div', { class: 'spatial-scene' },
          h('div', { class: 'spatial-axes' },
            h('div', { class: 'spatial-axis-x' }),
            h('div', { class: 'spatial-axis-z' }),
          ),
          h('div', { class: 'spatial-listener' }),
          h('div', { class: 'spatial-source', style: { left: '75%', top: '50%' } }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 声源位置（AudioParam）
const panner = new PannerNode(ctx, { panningModel: 'HRTF' });
panner.positionX.value = 5;    // 右侧 5 单位
panner.positionZ.value = -10;  // 前方 10 单位

// 声源朝向（指向性声源）
panner.orientationX.value = 1; // 朝 +X 辐射
panner.orientationZ.value = 0;

// AudioParam 自动化（平滑移动）
const t = ctx.currentTime;
panner.positionX.setValueAtTime(0, t);
panner.positionX.linearRampToValueAtTime(5, t + 2);

// requestAnimationFrame 实时动画（推荐）
function animate() {
  const t = ctx.currentTime - t0;
  panner.positionX.value = Math.sin(t) * 8;       // 左右摆动
  panner.positionZ.value = -10 - Math.cos(t) * 4;  // 前后移动
  requestAnimationFrame(animate);
}
animate();`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.positionInfo || '（点击按钮查看声源位置与朝向完整说明，真实浏览器可听到旋转声效）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. 距离衰减 —— distanceModel: linear/inverse/exponential + refDistance/maxDistance/rolloffFactor',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['PannerNode', f.pannerNode],
        ]),
        h(Tag, { color: 'primary' }, '衰减'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PannerNode.distanceModel 控制声源音量随距离衰减：linear（线性，物理不真实但简单，已被建议废弃）、inverse（反比，物理真实的点声源球面发散，默认推荐）、exponential（指数，更陡峭）。refDistance 参考距离（内全音量）、maxDistance 最大距离（外不再衰减）、rolloffFactor 衰减速率（越大衰减越快，linear 限制 0-1）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行距离衰减演示', { type: 'primary', size: 'sm', onClick: () => this._runDistanceDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 三种 distanceModel
panner.distanceModel = 'linear';       // 线性（物理不真实，已建议废弃）
panner.distanceModel = 'inverse';     // 反比（物理真实，默认推荐）
panner.distanceModel = 'exponential'; // 指数（更陡峭）

// 衰减参数
panner.refDistance = 1;     // 参考距离（内全音量）
panner.maxDistance = 50;    // 最大距离（外不再衰减）
panner.rolloffFactor = 1.5; // 衰减速率（越大越快，linear 限 0-1）

// 完整配置
const panner = new PannerNode(ctx, {
  panningModel: 'HRTF',
  distanceModel: 'inverse',
  refDistance: 1, maxDistance: 50, rolloffFactor: 1.5,
  positionZ: -10,
});
oscillator.connect(panner).connect(ctx.destination);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.distanceInfo || '（点击按钮查看距离衰减模型完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 声锥与立体声 —— cone* + StereoPannerNode + channelCount',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['PannerNode', f.pannerNode],
          ['StereoPanner', f.stereoPannerNode],
        ]),
        h(Tag, { color: 'primary' }, '声锥'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PannerNode 声锥（Sound Cone）实现指向性声源：coneInnerAngle（内锥全音量）、coneOuterAngle（外锥衰减到 coneOuterGain）、配合 orientationX/Y/Z 朝向。默认 360° 全向。StereoPannerNode 是 2D 简化版（仅 pan -1~+1 左右声像，无距离/朝向，CPU 极低）。channelCount 默认 2，HRTF 模式强制双声道输出。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行声锥与立体声演示', { type: 'primary', size: 'sm', onClick: () => this._runConeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 声锥（指向性声源）
panner.coneInnerAngle = 90;    // 内锥 90° 全音量
panner.coneOuterAngle = 270;   // 外锥 270° 衰减
panner.coneOuterGain = 0.1;    // 外锥外音量 10%
panner.orientationZ.value = -1; // 朝 -Z 辐射

// StereoPannerNode（2D 简易声像）
const sp = new StereoPannerNode(ctx, { pan: 0 });
sp.pan.value = -1;  // 全左
sp.pan.value = 0;   // 居中
sp.pan.value = 1;   // 全右
oscillator.connect(sp).connect(ctx.destination);

// 声锥 + 距离衰减组合
const panner = new PannerNode(ctx, {
  panningModel: 'HRTF', distanceModel: 'inverse',
  coneInnerAngle: 90, coneOuterAngle: 270, coneOuterGain: 0.1,
  orientationX: 0, orientationZ: -1,
  positionX: 3, positionZ: -5,
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.coneInfo || '（点击按钮查看声锥与立体声完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. WebXR 协同 —— AudioListener 与 WebXR 同步 + 头部跟踪 + XRRigidTransform',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['AudioContext', f.audioContext],
          ['WebXR', f.webxr],
        ]),
        h(Tag, { color: 'primary' }, 'WebXR'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'WebXR 沉浸式 VR/AR 中，用 requestAnimationFrame 同步头部姿态到 AudioListener：XRRigidTransform 提供 position + orientation（四元数），将四元数转换为 forward/up 向量写入 listener 的 6 个朝向 AudioParam，position 写入 3 个位置 AudioParam。声源与听者在同一 XR 参考空间（local-floor）坐标系。无 WebXR 时可用 DeviceOrientationEvent 近似头部跟踪。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 WebXR 协同演示', { type: 'primary', size: 'sm', onClick: () => this._runWebXRDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// WebXR 头部姿态 → AudioListener 同步
let xrRefSpace = null;
session.requestReferenceSpace('local-floor').then((rs: any) => {
  xrRefSpace = rs;
  session.requestAnimationFrame(onXRFrame);
});

function onXRFrame(time: any,  frame: any) {
  const pose = frame.getViewerPose(xrRefSpace);
  if (pose) {
    const pos = pose.transform.position;     // 位置
    const ori = pose.transform.orientation;  // 四元数 (x,y,z,w)

    // 位置同步
    listener.positionX.value = pos.x;
    listener.positionY.value = pos.y;
    listener.positionZ.value = pos.z;

    // 四元数 → forward/up 向量
    const { forward, up } = quatToVectors(ori);
    listener.forwardX.value = forward.x;
    listener.forwardZ.value = forward.z;
    listener.upX.value = up.x;
    listener.upY.value = up.y;
  }
  session.requestAnimationFrame(onXRFrame);
}

// 降级：DeviceOrientationEvent 近似头部跟踪
window.addEventListener($1, (e: any) => {
  // alpha/beta/gamma → 欧拉角 → 写入 listener
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.webxrInfo || '（点击按钮查看 WebXR 协同完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 多声道与 Ambisonics —— ChannelMerger/Splitter + MediaElement + 高阶环绕声',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['ChannelMerger', f.channelMergerNode],
          ['ChannelSplitter', f.channelSplitterNode],
          ['MediaElementSrc', f.mediaElementAudioSourceNode],
        ]),
        h(Tag, { color: 'primary' }, '多声道'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ChannelMergerNode 将多个单声道合并为多声道信号（5.1 环绕 6 声道），ChannelSplitterNode 反向拆分。MediaElementAudioSourceNode 把 <video>/<audio> 接入 Web Audio 图进行空间化处理。Ambisonics（高阶环绕声）用球谐函数编码全景声：FOA 4 声道 W/X/Y/Z，可整体旋转（头部跟踪高效），再用 ConvolverNode 做 HRTF 卷积解码为双耳。大量声源 + 头部跟踪时 Ambisonics 比 PannerNode 更高效。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行多声道与 Ambisonics 演示', { type: 'primary', size: 'sm', onClick: () => this._runMultichannelDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// ChannelMergerNode 多声道合并（5.1）
const merger = new ChannelMergerNode(ctx, { numberOfInputs: 6 });
src0.connect(merger, 0, 0);  // 第 1 声道
src1.connect(merger, 0, 1);  // 第 2 声道
// ... 6 个声道
merger.connect(ctx.destination);

// 视频空间化（MediaElementAudioSourceNode）
const video = document.querySelector('video');
const srcNode = new MediaElementAudioSourceNode(ctx, { mediaElement: video });
const panner = new PannerNode(ctx, { panningModel: 'HRTF' });
panner.positionX.value = 5;
srcNode.connect(panner).connect(ctx.destination);

// Ambisonics（FOA 4 声道 W/X/Y/Z）
const splitter = new ChannelSplitterNode(ctx, { numberOfOutputs: 4 });
// B-format → ConvolverNode HRTF 卷积 → 双耳
const convW = new ConvolverNode(ctx, { buffer: loadHRIR('W') });
// ... X/Y/Z 各做一次卷积`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.multichannelInfo || '（点击按钮查看多声道与 Ambisonics 完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 性能与生态 —— HRTF 开销 + 数量上限 + AudioWorklet 自定义 HRTF + ResonanceAudio',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['AudioContext', f.audioContext],
          ['AudioWorklet', f.audioWorklet],
        ]),
        h(Tag, { color: 'primary' }, '生态'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'HRTF 比 equalpower CPU 开销高 5-10x（频域卷积），桌面 Chrome HRTF 流畅 ~32 个、移动端 ~16 个，equalpower 可达数百个。AudioWorklet 可实现自定义 HRTF 卷积（个性化测量数据）。ResonanceAudio（Google）是基于 Web Audio 的高质量空间音频库，自实现 HRTF + 房间声学 + 高阶 Ambisonics。性能优化：静态声源用 equalpower、超 maxDistance 断开、Ambisonics 合并、移动端降级 StereoPannerNode。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行性能与生态演示', { type: 'primary', size: 'sm', onClick: () => this._runPerfDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// AudioWorklet 自定义 HRTF 卷积
class HRTFProcessor extends AudioWorkletProcessor {
  process(inputs: any, outputs: any){
    const input = inputs[0], output = outputs[0];
    for (let c = 0; c < output.length; c++) {
      const out = output[c], inCh = input[0] || input[c];
      for (let i = 0; i < out.length; i++) {
        out[i] = convolve(inCh, this.hrir[c], i);
      }
    }
    return true;
  }
}
registerProcessor('hrtf-processor', HRTFProcessor);

// 主线程使用
await ctx.audioWorklet.addModule('hrtf-processor.js');
const hrtfNode = new AudioWorkletNode(ctx, 'hrtf-processor');
oscillator.connect(hrtfNode).connect(ctx.destination);

// ResonanceAudio 集成
const scene = new ResonanceAudio(ctx, {
  ambisonicOrder: 3,
  roomDimensions: { width: 8, height: 4, depth: 8 },
});
scene.output.connect(ctx.destination);
const source = scene.createSource({ position: [3, 0, -2] });
oscillator.connect(source.input);`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.perfInfo || '（点击按钮查看性能与生态完整说明）')),
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
      h('h2', { class: 'section-title' }, 'Web Audio 空间音频（3D 定位）深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'AudioListener · PannerNode · panningModel(HRTF/equalpower) · 声锥 · StereoPannerNode · WebXR 头部跟踪 · Ambisonics · ResonanceAudio',
        description: 'Web Audio API 空间音频深度实验室。演示 AudioListener（BaseAudioContext.listener 单例 + positionX/Y/Z、forwardX/Y/Z、upX/Y/Z 九个 AudioParam 动画化）、PannerNode 构造与 panningModel（equalpower 等功率 vs HRTF 双耳渲染 + 性能对比）、声源 positionX/Y/Z + orientationX/Y/Z + AudioParam 自动化（linearRamp/setValueCurve/RAF 动画）、distanceModel 距离衰减（linear/inverse/exponential + refDistance/maxDistance/rolloffFactor）、声锥（coneInnerAngle/coneOuterAngle/coneOuterGain 指向性）+ StereoPannerNode 简易立体声 + channelCount、WebXR 协同（XRRigidTransform 四元数 → forward/up 向量 + 头部跟踪 + requestAnimationFrame 同步）、多声道（ChannelMerger/SplitterNode + MediaElementAudioSourceNode 视频空间化 + Ambisonics 高阶环绕声 FOA 4 声道）、性能与生态（HRTF vs equalpower CPU 开销 + PannerNode 数量上限 + AudioWorklet 自定义 HRTF 卷积 + ResonanceAudio 房间声学 + 浏览器支持矩阵）。AudioContext 必须用户手势内创建/恢复；jsdom 环境无 Web Audio，所有调用前做 typeof/in 检测，不可用时仅记日志不抛异常；真实浏览器（Chrome/Firefox/Edge/Safari）可创建 PannerNode 并用 RAF 动画化声源位置，建议戴耳机体验 HRTF 双耳渲染。',
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
