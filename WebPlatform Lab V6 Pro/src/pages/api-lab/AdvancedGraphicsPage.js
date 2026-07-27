// =====================================================================
// AdvancedGraphicsPage.js —— 高级图形与渲染 API 实验室
// 演示 MDN：
//   1. WebGL2 新特性（createVertexArray / bindVertexArray / getUniformBlockIndex /
//      uniformBlockBinding / bindTransformFeedback / drawArraysInstanced / GLSL ES 3.00）
//   2. WebGPU（navigator.gpu.requestAdapter / requestDevice / createBuffer /
//      createShaderModule / createRenderPipeline / createCommandEncoder / queue.submit / WGSL）
//   3. CSS Houdini（CSS.paintWorklet.addModule / layoutWorklet / animationWorklet /
//      CSS.registerProperty / paint() 函数）
//   4. WebCodecs API（VideoDecoder / VideoEncoder / AudioDecoder / AudioEncoder /
//      isConfigSupported / EncodedVideoChunk / VideoFrame / AudioData）
//   5. Scroll-driven Animations（animation-timeline: scroll() / view() /
//      animation-range / view-timeline / scroll-timeline）
// =====================================================================

import { Page } from '../../core/Component.js';
import { h, formatTime, throttle } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// ===================== WebGL2 GLSL ES 3.00 着色器源码 =====================

// 顶点着色器：使用 in/out 语法（ES 3.00），从 uniform block 读取基础色，
// 通过 gl_InstanceID 为每个实例偏移并调色（演示实例化渲染）
const WEBGL2_VERT = `#version 300 es
in vec2 aPos;
out vec3 vCol;
uniform Block { vec3 uBase; };
void main() {
  float i = float(gl_InstanceID);
  vCol = vec3(uBase.r + i * 0.18, uBase.g, uBase.b + i * 0.1);
  vec2 offset = vec2((i - 1.0) * 0.55, 0.0);
  gl_Position = vec4(aPos * 0.3 + offset, 0.0, 1.0);
}`;

// 片段着色器：使用 out fragColor（ES 3.00，不再用 gl_FragColor）
const WEBGL2_FRAG = `#version 300 es
precision highp float;
in vec3 vCol;
out vec4 fragColor;
void main() {
  fragColor = vec4(vCol, 1.0);
}`;

// ===================== WebGPU WGSL 着色器源码 =====================

const WGSL_SHADER = `
@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 0.6),
    vec2<f32>(-0.6, -0.4),
    vec2<f32>(0.6, -0.4),
  );
  return vec4<f32>(pos[idx], 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(0.09, 0.467, 1.0, 1.0);
}
`;

// ===================== CSS Houdini Paint Worklet 源码（用于 Blob URL 内联） =====================

// 通过 registerPaint 注册一个圆角渐变背景绘制器，
// 读取自定义属性 --paint-radius / --paint-from / --paint-to
const PAINT_WORKLET_SRC = `
registerPaint('roundedGradient', class {
  static get inputProperties() {
    return ['--paint-radius', '--paint-from', '--paint-to'];
  }
  paint(ctx, geom, props) {
    const r = parseFloat(props.get('--paint-radius')) || 16;
    const from = (props.get('--paint-from') || '').toString().trim() || '#1677ff';
    const to = (props.get('--paint-to') || '').toString().trim() || '#722ed1';
    const w = geom.width, h = geom.height;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    ctx.fillStyle = g;
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(0, 0, w, h, r); }
    else { ctx.rect(0, 0, w, h); }
    ctx.fill();
  }
});
`;

// ===================== WebCodecs 待检测编解码器列表 =====================

const VIDEO_CODECS = [
  { codec: 'avc1.42001E', label: 'H.264 (AVC) Baseline' },
  { codec: 'vp09.00.10.08', label: 'VP9' },
  { codec: 'av01.0.04M.08', label: 'AV1' },
  { codec: 'hev1.1.6.L93.B0', label: 'H.265 (HEVC)' },
  { codec: 'theora', label: 'Theora' },
];

const AUDIO_CODECS = [
  { codec: 'mp4a.40.2', label: 'AAC (LC)' },
  { codec: 'opus', label: 'Opus' },
  { codec: 'flac', label: 'FLAC' },
  { codec: 'vorbis', label: 'Vorbis' },
  { codec: 'alaw', label: 'A-law PCM' },
];

// ===================== WebGL1 与 WebGL2 特性对比表 =====================

const WEBGL_COMPARE = [
  { feature: 'GLSL 版本', v1: '1.0 ES（#version 100）', v2: '3.0 ES（#version 300 es）' },
  { feature: 'VAO 顶点数组对象', v1: '扩展 OES_vertex_array_object', v2: '内置 createVertexArray' },
  { feature: 'UBO 一致性缓冲区', v1: '不支持', v2: '内置 uniformBlockBinding' },
  { feature: 'Transform Feedback', v1: '不支持', v2: '内置 beginTransformFeedback' },
  { feature: '实例化渲染', v1: '扩展 ANGLE_instanced_arrays', v2: '内置 drawArraysInstanced' },
  { feature: '3D 纹理', v1: '不支持', v2: 'texImage3D 支持' },
  { feature: '多采样纹理', v1: '不支持', v2: 'texStorage2DMultisample' },
  { feature: 'Sampler 对象', v1: '不支持', v2: 'createSampler 支持' },
];

export class AdvancedGraphicsPage extends Page {
  initialState() {
    return {
      logs: [],
      // Card 1: WebGL2
      webgl2Supported: false,
      webgl2Info: '',
      // Card 2: WebGPU
      webgpuSupported: false,
      webgpuStage: '未初始化',
      webgpuAdapterInfo: '',
      webgpuDeviceInfo: '',
      webgpuBufferCreated: false,
      // Card 3: CSS Houdini
      paintWorkletSupported: false,
      paintWorkletAdded: false,
      registerPropertySupported: false,
      registerPropertyDone: false,
      // Card 4: WebCodecs
      webcodecsSupported: false,
      webcodecsVideo: [],
      webcodecsAudio: [],
      // Card 5: Scroll-driven
      scrollAnimSupported: false,
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：避免 setState → rerender → componentDidMount 死循环导致 OOM。
    // 每次挂载都需要重建的演示（canvas 绑定 / 动态 style / 滚动监听）放在守卫之前，
    // 一次性初始化（能力检测 + 异步资源获取）放在守卫之后。
    this._injectDemoStyles();
    this._drawWebGL2();
    this._bindScrollListener();
    this._restoreScrollTop();
    this._refreshScrollText();

    if (this._inited) return;
    this._inited = true;

    // 一次性初始化
    this._detectWebGL2();
    this._detectScrollAnim();
    this._initWebGPU();
    this._initHoudini();
    this._initWebCodecs();
  }

  componentWillUnmount() {
    // 取消 WebGL2 动画的 requestAnimationFrame
    if (this._webgl2Raf) {
      cancelAnimationFrame(this._webgl2Raf);
      this._webgl2Raf = null;
    }
    // 销毁 WebGPU device（释放 GPU 资源）
    if (this._gpuDevice) {
      try { this._gpuDevice.destroy(); } catch { /* noop */ }
      this._gpuDevice = null;
    }
    // 移除动态注入的 style 元素
    this._demoStyleEl?.remove();
    // 撤销 Paint Worklet 的 Blob URL
    if (this._paintWorkletUrl) {
      try { URL.revokeObjectURL(this._paintWorkletUrl); } catch { /* noop */ }
      this._paintWorkletUrl = null;
    }
    // 其余事件监听由 Component.destroy 统一解绑（_eventBindings）
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

  // —— 注入演示样式（Houdini paint 演示 + Scroll-driven 动画 + GPU 信息表格）——
  _injectDemoStyles() {
    if (this._demoStyleEl) this._demoStyleEl.remove();
    const style = document.createElement('style');
    style.id = 'advanced-graphics-demo-style';
    style.textContent = `
      /* CSS Houdini paint() 演示：背景由 Paint Worklet 绘制 */
      .houdini-paint-demo {
        --paint-radius: 24px;
        --paint-from: #1677ff;
        --paint-to: #722ed1;
        background: paint(roundedGradient);
        height: 96px;
        border-radius: var(--radius-base);
        border: 1px solid var(--color-border-secondary);
      }
      .houdini-paint-demo--alt {
        --paint-radius: 48px;
        --paint-from: #52c41a;
        --paint-to: #faad14;
      }
      /* Scroll-driven animations 演示 */
      .scroll-anim-container {
        max-height: 240px;
        overflow: auto;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-base);
        position: relative;
        padding: var(--spacing-md);
      }
      .scroll-progress-track {
        position: sticky;
        top: 0;
        height: 6px;
        background: var(--color-fill);
        border-radius: var(--radius-pill);
        margin-bottom: var(--spacing-md);
        overflow: hidden;
      }
      .scroll-progress-bar {
        height: 100%;
        width: 100%;
        background: linear-gradient(90deg, #1677ff, #722ed1);
        transform-origin: 0 0;
        /* 关键：animation-timeline 绑定到最近滚动容器 */
        animation: scroll-progress linear both;
        animation-timeline: scroll();
      }
      @keyframes scroll-progress {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }
      .scroll-view-item {
        padding: var(--spacing-md);
        margin: var(--spacing-sm) 0;
        background: var(--color-bg-spotlight);
        border-radius: var(--radius-base);
        border-left: 3px solid var(--color-primary);
        /* view() 时间线：元素进入视口时触发淡入位移动画 */
        animation: scroll-view-fade linear both;
        animation-timeline: view();
        animation-range: entry 0% cover 40%;
      }
      @keyframes scroll-view-fade {
        from { opacity: 0.3; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      /* GPU 信息 / 对比表格 */
      .gpu-info-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
      .gpu-info-table th, .gpu-info-table td {
        padding: 6px 10px; border: 1px solid var(--color-border-secondary); text-align: left;
      }
      .gpu-info-table th { background: var(--color-bg-spotlight); width: 32%; }
      .gpu-info-table code { font-family: var(--font-family-mono); color: var(--color-primary); }
    `;
    document.head.appendChild(style);
    this._demoStyleEl = style;
  }

  // ===================== Card 1: WebGL2 新特性 =====================

  // 能力检测 + GPU 信息（一次性，守卫后调用）
  _detectWebGL2() {
    const supported = typeof WebGL2RenderingContext !== 'undefined';
    let info = '';
    let hasCtx = false;
    if (supported) {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        if (gl) {
          hasCtx = true;
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          info = [
            `VERSION: ${gl.getParameter(gl.VERSION)}`,
            `SHADING_LANGUAGE_VERSION: ${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`,
            `VENDOR: ${gl.getParameter(gl.VENDOR)}`,
            `RENDERER: ${gl.getParameter(gl.RENDERER)}`,
            dbg ? `UNMASKED_RENDERER_WEBGL: ${gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)}`
                : 'UNMASKED_RENDERER_WEBGL: (WEBGL_debug_renderer_info 不可用)',
          ].join('\n');
        }
      } catch (err) {
        this._addLog('error', `WebGL2 检测异常：${err.message}`);
      }
    }
    this.setState({
      webgl2Supported: hasCtx,
      webgl2Info: info || '（当前环境无 WebGL2 上下文）',
      logs: [...this.state.logs, {
        type: 'webgl2',
        content: hasCtx
          ? `WebGL2 支持 ✓ | VAO ✓ | UBO ✓ | Transform Feedback ✓ | drawArraysInstanced ✓ | GLSL ES 3.00 ✓`
          : (supported ? 'WebGL2RenderingContext 已定义但 getContext("webgl2") 返回 null' : 'WebGL2 不支持（typeof WebGL2RenderingContext === "undefined"）'),
        time: formatTime(),
      }].slice(-40),
    });
  }

  // 编译单个 GLSL ES 3.00 着色器
  _compileWebGL2Shader(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`着色器编译失败: ${log}`);
    }
    return shader;
  }

  // 绘制 WebGL2 场景：VAO + UBO + 实例化渲染 + Transform Feedback
  // 每次挂载重建（canvas 绑定），无 setState/无日志（避免 rerender 循环）
  _drawWebGL2() {
    if (this._webgl2Raf) { cancelAnimationFrame(this._webgl2Raf); this._webgl2Raf = null; }
    const canvas = this.$('.webgl2-canvas');
    if (!canvas) return;
    const gl = canvas.getContext('webgl2');
    if (!gl) return;

    let program;
    try {
      const vs = this._compileWebGL2Shader(gl, gl.VERTEX_SHADER, WEBGL2_VERT);
      const fs = this._compileWebGL2Shader(gl, gl.FRAGMENT_SHADER, WEBGL2_FRAG);
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`链接失败: ${gl.getProgramInfoLog(program)}`);
      }
      gl.useProgram(program);
    } catch (err) {
      // 着色器失败仅记录一次，避免每次重渲染重复打印
      if (!this._webgl2ShaderErr) {
        this._webgl2ShaderErr = true;
        this._addLog('error', `WebGL2 着色器初始化失败：${err.message}`);
      }
      return;
    }

    // —— VAO：createVertexArray / bindVertexArray ——
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // 顶点数据：一个三角形（3 顶点 × 2 分量）
    const vertices = new Float32Array([0.0, 1.0, -1.0, -1.0, 1.0, -1.0]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // —— UBO：getUniformBlockIndex / uniformBlockBinding / bindBufferBase ——
    const blockIndex = gl.getUniformBlockIndex(program, 'Block');
    const ubo = gl.createBuffer();
    if (blockIndex !== gl.INVALID_INDEX) {
      gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
      gl.bufferData(gl.UNIFORM_BUFFER, new Float32Array([0.1, 0.6, 0.9]), gl.DYNAMIC_DRAW);
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);
      gl.uniformBlockBinding(program, blockIndex, 0);
    }

    // —— Transform Feedback：createTransformFeedback / bindTransformFeedback ——
    const tf = gl.createTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.15, 1.0);

    // —— 实例化渲染：drawArraysInstanced（用 rAF 让 UBO 颜色随时间脉动）——
    const start = performance.now();
    const loop = (now) => {
      // canvas 已脱离 DOM（rerender 后）→ 自动停止，避免无效绘制
      if (!canvas.isConnected) { this._webgl2Raf = null; return; }
      const t = (now - start) / 1000;
      // 动态写入 UBO 数据（演示 bufferSubData）
      if (blockIndex !== gl.INVALID_INDEX) {
        const r = 0.5 + 0.5 * Math.sin(t * 1.5);
        gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, new Float32Array([r, 0.6, 0.9]));
      }
      gl.clear(gl.COLOR_BUFFER_BIT);
      // drawArraysInstanced(mode, first, count, instanceCount) → 绘制 3 个实例
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 3);
      this._webgl2Raf = requestAnimationFrame(loop);
    };
    this._webgl2Raf = requestAnimationFrame(loop);
  }

  // 查询 WebGL2 支持的扩展列表（按钮触发）
  _queryWebGL2Exts() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (!gl) { this._addLog('webgl2', '查询扩展失败：无 WebGL2 上下文'); return; }
      const exts = gl.getSupportedExtensions() || [];
      const preview = exts.slice(0, 5).join(', ');
      this._addLog('webgl2', `getSupportedExtensions → ${exts.length} 个扩展：${preview}${exts.length > 5 ? ' ...' : ''}`);
    } catch (err) {
      this._addLog('error', `查询扩展失败：${err.message}`);
    }
  }

  // 渲染 WebGL1 vs WebGL2 对比表
  _renderWebGL2Compare() {
    return h('table', { class: 'gpu-info-table' },
      h('thead', {}, h('tr', {},
        h('th', {}, '特性'), h('th', {}, 'WebGL1'), h('th', {}, 'WebGL2'))),
      h('tbody', {},
        ...WEBGL_COMPARE.map((row) => h('tr', {},
          h('th', {}, row.feature), h('td', {}, row.v1), h('td', {}, row.v2))),
      ),
    );
  }

  // ===================== Card 2: WebGPU =====================

  async _initWebGPU() {
    const supported = 'gpu' in navigator;
    this.setState({
      webgpuSupported: supported,
      webgpuStage: supported ? '检测到 navigator.gpu，请求 adapter...' : '不支持',
      logs: [...this.state.logs, {
        type: 'webgpu',
        content: supported
          ? 'navigator.gpu 可用，开始 requestAdapter()'
          : 'WebGPU 不可用（"gpu" in navigator === false）',
        time: formatTime(),
      }].slice(-40),
    });
    if (!supported) return;

    try {
      // 1. requestAdapter
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
      if (!adapter) {
        this.setState({ webgpuStage: 'requestAdapter 返回 null（无可用 GPU 适配器）' });
        this._addLog('webgpu', 'requestAdapter 返回 null（无可用 GPU 适配器）');
        return;
      }
      // 2. requestDevice
      const device = await adapter.requestDevice();
      this._gpuDevice = device;

      // 适配器信息（adapter.info 优先，回退 requestAdapterInfo）
      let adapterInfo = '（无 adapter.info）';
      if (adapter.info) {
        const i = adapter.info;
        adapterInfo = `vendor=${i.vendor}, architecture=${i.architecture}, device=${i.device}, description=${i.description}`;
      } else if (typeof adapter.requestAdapterInfo === 'function') {
        try {
          const ai = await adapter.requestAdapterInfo();
          adapterInfo = `vendor=${ai.vendor}, device=${ai.device}, description=${ai.description}`;
        } catch { /* noop */ }
      }
      const limits = device.limits || {};
      const deviceInfo = `maxBufferSize=${limits.maxBufferSize}, maxStorageBufferBindingSize=${limits.maxStorageBufferBindingSize}, maxTextureDimension2D=${limits.maxTextureDimension2D}`;

      // 3. createBuffer + queue.writeBuffer（演示 uniform buffer 写入）
      const buffer = device.createBuffer({
        size: 16, // 4 × float32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(buffer, 0, new Float32Array([0.1, 0.6, 0.9, 1.0]));

      // 4. createShaderModule（WGSL）
      const shaderModule = device.createShaderModule({ code: WGSL_SHADER });

      // 5. createRenderPipeline（vertex + fragment + primitive，不实际渲染到 canvas）
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vs_main' },
        fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format: 'bgra8unorm' }] },
        primitive: { topology: 'triangle-list' },
      });

      // 6. createCommandEncoder + submit（演示命令编码与提交流程）
      const encoder = device.createCommandEncoder();
      // 不调用 beginRenderPass（需要 canvas context 的 texture view），仅演示 encoder 创建
      device.queue.submit([encoder.finish()]);

      buffer.destroy();

      this.setState({
        webgpuStage: '已创建 device + buffer + shaderModule + pipeline + submit',
        webgpuAdapterInfo: adapterInfo,
        webgpuDeviceInfo: deviceInfo,
        webgpuBufferCreated: true,
        logs: [...this.state.logs, {
          type: 'webgpu',
          content: `adapter ✓ | device ✓ | createBuffer ✓ | writeBuffer ✓ | createShaderModule(WGSL) ✓ | createRenderPipeline ✓ | submit ✓`,
          time: formatTime(),
        }].slice(-40),
      });
    } catch (err) {
      this.setState({ webgpuStage: `失败：${err.message}` });
      this._addLog('error', `WebGPU 初始化失败：${err.message}`);
    }
  }

  // ===================== Card 3: CSS Houdini =====================

  async _initHoudini() {
    const paintSupported = typeof CSS !== 'undefined' && typeof CSS.paintWorklet !== 'undefined';
    const layoutSupported = typeof CSS !== 'undefined' && typeof CSS.layoutWorklet !== 'undefined';
    const animSupported = typeof CSS !== 'undefined' && typeof CSS.animationWorklet !== 'undefined';
    const regPropSupported = typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function';

    this.setState({
      paintWorkletSupported: paintSupported,
      registerPropertySupported: regPropSupported,
      logs: [...this.state.logs, {
        type: 'houdini',
        content: `paintWorklet=${paintSupported} | layoutWorklet=${layoutSupported} | animationWorklet=${animSupported} | registerProperty=${regPropSupported}`,
        time: formatTime(),
      }].slice(-40),
    });

    // —— Properties & Values API：CSS.registerProperty 注册自定义属性 ——
    if (regPropSupported && !this._regPropDone) {
      try {
        CSS.registerProperty({ name: '--paint-radius', syntax: '<length>', inherits: false, initialValue: '16px' });
        CSS.registerProperty({ name: '--paint-from', syntax: '<color>', inherits: false, initialValue: '#1677ff' });
        CSS.registerProperty({ name: '--paint-to', syntax: '<color>', inherits: false, initialValue: '#722ed1' });
        this._regPropDone = true;
        this.setState({ registerPropertyDone: true });
        this._addLog('houdini', 'registerProperty ✓：--paint-radius(<length>)、--paint-from/to(<color>)');
      } catch (err) {
        this._addLog('error', `registerProperty 失败：${err.message}`);
      }
    }

    // —— Paint Worklet：CSS.paintWorklet.addModule(Blob URL) ——
    if (paintSupported && !this._paintAdded) {
      try {
        const blob = new Blob([PAINT_WORKLET_SRC], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        this._paintWorkletUrl = url;
        await CSS.paintWorklet.addModule(url);
        this._paintAdded = true;
        this.setState({ paintWorkletAdded: true });
        this._addLog('houdini', 'paintWorklet.addModule(Blob URL) ✓：已注册 paint(roundedGradient)');
      } catch (err) {
        this._addLog('error', `paintWorklet.addModule 失败：${err.message}`);
      }
    } else if (!paintSupported) {
      this._addLog('houdini', 'CSS.paintWorklet 不可用，paint() 函数将无效果');
    }
  }

  // ===================== Card 4: WebCodecs API =====================

  async _initWebCodecs() {
    const supported = typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined'
      && typeof AudioDecoder !== 'undefined';
    this.setState({
      webcodecsSupported: supported,
      logs: [...this.state.logs, {
        type: 'webcodecs',
        content: supported
          ? 'WebCodecs 可用（VideoDecoder/VideoEncoder/AudioDecoder/AudioEncoder）'
          : 'WebCodecs 不可用（typeof VideoDecoder === "undefined"）',
        time: formatTime(),
      }].slice(-40),
    });
    if (!supported) return;

    // 通过 isConfigSupported({ codec }) 检测视频编解码器支持
    const videoResults = [];
    for (const { codec, label } of VIDEO_CODECS) {
      try {
        const result = await VideoDecoder.isConfigSupported({ codec });
        videoResults.push({ codec, label, supported: !!result.supported });
      } catch (err) {
        videoResults.push({ codec, label, supported: false, error: err.message });
      }
    }
    // 检测音频编解码器支持
    const audioResults = [];
    for (const { codec, label } of AUDIO_CODECS) {
      try {
        const result = await AudioDecoder.isConfigSupported({ codec });
        audioResults.push({ codec, label, supported: !!result.supported });
      } catch (err) {
        audioResults.push({ codec, label, supported: false, error: err.message });
      }
    }
    const vOk = videoResults.filter((r) => r.supported).length;
    const aOk = audioResults.filter((r) => r.supported).length;
    this.setState({
      webcodecsVideo: videoResults,
      webcodecsAudio: audioResults,
      logs: [...this.state.logs, {
        type: 'webcodecs',
        content: `isConfigSupported 检测完成：视频 ${vOk}/${videoResults.length}，音频 ${aOk}/${audioResults.length}`,
        time: formatTime(),
      }].slice(-40),
    });
  }

  // ===================== Card 5: Scroll-driven Animations =====================

  // 能力检测（一次性，守卫后调用）
  _detectScrollAnim() {
    let supported = false;
    try { supported = CSS.supports('animation-timeline', 'scroll()'); } catch { supported = false; }
    this.setState({
      scrollAnimSupported: supported,
      logs: [...this.state.logs, {
        type: 'scroll',
        content: supported
          ? 'scroll-driven animations 支持（CSS.supports("animation-timeline","scroll()") ✓）'
          : 'scroll-driven animations 不支持（CSS.supports 返回 false）',
        time: formatTime(),
      }].slice(-40),
    });
  }

  // 绑定滚动监听（每次挂载都重新绑定，rerender 后容器是新的）
  _bindScrollListener() {
    const c = this.$('.scroll-anim-container');
    if (!c) return;
    // 节流：避免滚动时频繁触发 setState 导致容器重置
    const handler = throttle(() => {
      this._savedScrollTop = c.scrollTop;
      this._refreshScrollText();
      // 仅在滚动幅度 > 60px 时记录到日志，减少 rerender
      if (Math.abs(c.scrollTop - (this._lastLoggedScroll ?? 0)) > 60) {
        this._lastLoggedScroll = c.scrollTop;
        const pct = ((c.scrollTop / (c.scrollHeight - c.clientHeight || 1)) * 100).toFixed(0);
        this._addLog('scroll', `scrollTop = ${c.scrollTop}px / ${c.scrollHeight}px（${pct}%）`);
      }
    }, 200);
    this.on(c, 'scroll', handler);
  }

  // 恢复滚动位置（rerender 后容器会重置为 0）
  _restoreScrollTop() {
    if (this._savedScrollTop == null) return;
    const c = this.$('.scroll-anim-container');
    if (c) c.scrollTop = this._savedScrollTop;
  }

  // 更新滚动位置文本（直接操作 DOM，不触发 rerender）
  _refreshScrollText() {
    const c = this.$('.scroll-anim-container');
    const pos = this.$('.scroll-position');
    if (c && pos) {
      const pct = ((c.scrollTop / (c.scrollHeight - c.clientHeight || 1)) * 100).toFixed(0);
      pos.textContent = `${c.scrollTop} / ${c.scrollHeight} px（${pct}%）`;
    }
  }

  // ===================== 日志面板 =====================

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // ===================== 渲染 =====================

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, '高级图形与渲染 API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'WebGL2 · WebGPU · CSS Houdini · WebCodecs · Scroll-driven Animations',
        description: '五大新一代图形/渲染 API 综合演示。这些 API 大多需要现代浏览器（Chrome 113+ / Edge）与真实 GPU 支持；jsdom 环境下仅展示能力检测与调用流程，所有调用前均做 typeof / in 检测，不可用时记日志说明。',
      }),

      // ============ Card 1: WebGL2 新特性 ============
      h(Card, {
        title: '1. WebGL2 新特性（VAO / UBO / Transform Feedback / 实例化渲染 / GLSL ES 3.00）',
        extra: h(Tag, { color: s.webgl2Supported ? 'success' : 'error' }, s.webgl2Supported ? '已就绪' : '不支持'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'canvas.getContext(\'webgl2\') 获取上下文（能力检测：typeof WebGL2RenderingContext）。WebGL2 内置 VAO（createVertexArray / bindVertexArray）、UBO（getUniformBlockIndex / uniformBlockBinding / bindBufferBase）、Transform Feedback（bindTransformFeedback）、实例化渲染（drawArraysInstanced），并使用 #version 300 es 的 GLSL 3.00 ES（in/out 语法、out fragColor、gl_InstanceID）。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('重绘场景', { type: 'primary', size: 'sm', onClick: () => { this._drawWebGL2(); this._addLog('webgl2', '手动重绘 WebGL2 场景（VAO + UBO + drawArraysInstanced）'); } }),
            this._btn('查询扩展', { size: 'sm', onClick: () => this._queryWebGL2Exts() }),
          ),
          h('canvas', { class: 'webgl2-canvas', width: 480, height: 200 }),
          h('div', { class: 'fs-sm text-secondary mt-xs' }, 'GPU 信息（getParameter + WEBGL_debug_renderer_info.UNMASKED_RENDERER_WEBGL）：'),
          h('pre', { class: 'code-block' }, s.webgl2Info),
          h('div', { class: 'fs-sm text-secondary mt-xs' }, 'WebGL1 与 WebGL2 特性对比：'),
          this._renderWebGL2Compare(),
        ),
      ),

      // ============ Card 2: WebGPU ============
      h(Card, {
        title: '2. WebGPU（navigator.gpu / WGSL / 渲染管线）',
        extra: h(Tag, { color: s.webgpuSupported ? (s.webgpuBufferCreated ? 'success' : 'warning') : 'error' },
          s.webgpuSupported ? (s.webgpuBufferCreated ? '已初始化' : '初始化中') : '不支持'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '能力检测：\'gpu\' in navigator。流程：navigator.gpu.requestAdapter() → adapter.requestDevice() → device.createBuffer / createShaderModule / createRenderPipeline → createCommandEncoder → queue.submit。着色器语言为 WGSL。jsdom 无 GPU，仅展示调用流程。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('重新初始化', { type: 'primary', size: 'sm', onClick: () => this._initWebGPU() }),
          ),
          h('div', { class: 'fs-sm' },
            h('strong', {}, '阶段：'),
            h('span', { class: 'text-secondary' }, s.webgpuStage),
          ),
          s.webgpuAdapterInfo && h('div', { class: 'fs-sm text-secondary' }, `Adapter: ${s.webgpuAdapterInfo}`),
          s.webgpuDeviceInfo && h('div', { class: 'fs-sm text-secondary' }, `Device limits: ${s.webgpuDeviceInfo}`),
          h('div', { class: 'fs-sm text-secondary mt-xs' }, 'WGSL 着色器源码（createShaderModule）：'),
          h('pre', { class: 'code-block' }, WGSL_SHADER.trim()),
        ),
      ),

      // ============ Card 3: CSS Houdini ============
      h(Card, {
        title: '3. CSS Houdini（Paint Worklet / registerProperty / paint() 函数）',
        extra: h(Tag, { color: s.paintWorkletSupported ? 'success' : 'warning' }, s.paintWorkletSupported ? '支持' : '实验性'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'CSS.paintWorklet.addModule(url) 注册 Paint Worklet（此处用 Blob URL 内联 worklet 代码），CSS.registerProperty 注册自定义属性（Properties & Values API），元素背景使用 paint(worklet-name) 调用。能力检测：typeof CSS.paintWorklet。layoutWorklet / animationWorklet 同理。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('重新注册', { type: 'primary', size: 'sm', onClick: () => this._initHoudini() }),
          ),
          h('div', { class: 'flex gap-sm' },
            h('div', { class: 'houdini-paint-demo flex-1' }),
            h('div', { class: 'houdini-paint-demo houdini-paint-demo--alt flex-1' }),
          ),
          h('div', { class: 'fs-sm text-secondary' },
            `paintWorklet: ${s.paintWorkletSupported ? '✓' : '✗'} | registerProperty: ${s.registerPropertySupported ? '✓' : '✗'} | 已 addModule: ${s.paintWorkletAdded ? '✓' : '✗'} | 已 registerProperty: ${s.registerPropertyDone ? '✓' : '✗'}`,
          ),
          h('div', { class: 'fs-sm text-secondary mt-xs' }, 'Paint Worklet 源码（通过 Blob URL 内联，addModule 加载）：'),
          h('pre', { class: 'code-block' }, PAINT_WORKLET_SRC.trim()),
        ),
      ),

      // ============ Card 4: WebCodecs API ============
      h(Card, {
        title: '4. WebCodecs API（VideoDecoder / AudioDecoder / isConfigSupported）',
        extra: h(Tag, { color: s.webcodecsSupported ? 'success' : 'error' }, s.webcodecsSupported ? '支持' : '不支持'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '能力检测：typeof VideoDecoder。VideoDecoder/VideoEncoder/AudioDecoder/AudioEncoder 通过 isConfigSupported({ codec }) 查询编解码器支持。EncodedVideoChunk / EncodedAudioChunk / VideoFrame / AudioData 为数据载体。本演示不实际解码（需真实视频数据），仅展示 API 调用流程。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('重新检测', { type: 'primary', size: 'sm', onClick: () => this._initWebCodecs() }),
          ),
          s.webcodecsSupported
            ? h('div', { class: 'flex gap-md' },
                h('div', { class: 'flex-1' },
                  h('div', { class: 'fs-sm fw-medium mb-xs' }, '视频编解码器（VideoDecoder.isConfigSupported）'),
                  h('div', { class: 'flex flex-col gap-xs' },
                    ...s.webcodecsVideo.map((r) => h('div', { class: 'flex items-center gap-xs fs-sm' },
                      h(Tag, { color: r.supported ? 'success' : 'default' }, r.supported ? '✓' : '✗'),
                      h('span', {}, r.label),
                      h('code', { class: 'text-tertiary' }, r.codec),
                    )),
                  ),
                ),
                h('div', { class: 'flex-1' },
                  h('div', { class: 'fs-sm fw-medium mb-xs' }, '音频编解码器（AudioDecoder.isConfigSupported）'),
                  h('div', { class: 'flex flex-col gap-xs' },
                    ...s.webcodecsAudio.map((r) => h('div', { class: 'flex items-center gap-xs fs-sm' },
                      h(Tag, { color: r.supported ? 'success' : 'default' }, r.supported ? '✓' : '✗'),
                      h('span', {}, r.label),
                      h('code', { class: 'text-tertiary' }, r.codec),
                    )),
                  ),
                ),
              )
            : h(Alert, { type: 'warning', message: '当前环境不支持 WebCodecs', description: '请在 Chrome / Edge 94+ 中查看本演示。' }),
        ),
      ),

      // ============ Card 5: Scroll-driven Animations ============
      h(Card, {
        title: '5. Scroll-driven Animations（animation-timeline: scroll() / view()）',
        extra: h(Tag, { color: s.scrollAnimSupported ? 'success' : 'warning' }, s.scrollAnimSupported ? '支持' : '实验性'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'CSS 原生滚动驱动动画，无需 JS。animation-timeline: scroll() 绑定到最近滚动容器；animation-timeline: view() 在元素进入视口时触发；animation-range 控制动画区间。下方容器可滚动，顶部进度条随滚动伸缩，列表项进入视口时淡入。同时用 JS（scroll 事件）观察并记录 scrollTop 变化。'),
          h('div', { class: 'flex items-center gap-sm' },
            h('span', { class: 'fs-sm text-secondary' }, '滚动位置：'),
            h('span', { class: 'fs-sm fw-medium scroll-position' }, '0 / 0 px'),
          ),
          h('div', { class: 'scroll-anim-container' },
            h('div', { class: 'scroll-progress-track' },
              h('div', { class: 'scroll-progress-bar' }),
            ),
            ...Array.from({ length: 12 }, (_, i) => h('div', { class: 'scroll-view-item' },
              h('div', { class: 'fw-medium' }, `条目 #${i + 1}`),
              h('div', { class: 'fs-sm text-secondary' }, '此元素绑定 animation-timeline: view()，进入滚动视口时触发淡入位移动画（animation-range: entry 0% cover 40%）。'),
            )),
          ),
          h('div', { class: 'fs-sm text-secondary mt-xs' }, '关键 CSS：'),
          h('pre', { class: 'code-block' },
            `.scroll-progress-bar {\n  animation: scroll-progress linear both;\n  animation-timeline: scroll();\n}\n.scroll-view-item {\n  animation: scroll-view-fade linear both;\n  animation-timeline: view();\n  animation-range: entry 0% cover 40%;\n}`),
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
