// =====================================================================
// WebGPURenderPipelinePage.js —— WebGPU 渲染管线实验室
// 演示 MDN：1) 顶点缓冲与属性（device.createBuffer VERTEX|COPY_DST / queue.writeBuffer /
//      GPUVertexBufferLayout{arrayStride, attributes[{shaderLocation, offset, format}]} /
//      renderPipeline.vertex{module, entryPoint, buffers[vertexLayout]} / passEncoder.setVertexBuffer(0, buf)）
//   2) 索引缓冲与绘制（device.createBuffer INDEX|COPY_DST / queue.writeBuffer(Uint16Array) /
//      passEncoder.setIndexBuffer(buf, 'uint16'|'uint32') / drawIndexed(idxCount, instCount, firstIdx, baseVertex, firstInst)
//      vs draw(vertCount, instCount, firstVert, firstInst) / GPUPrimitiveTopology: triangle-list|line-list|point-list|triangle-strip）
//   3) Uniform 缓冲与 BindGroup（device.createBuffer UNIFORM|COPY_DST / vec4 16 字节对齐 / minUniformBufferOffsetAlignment /
//      createBindGroupLayout{buffer.type:'uniform'} / createPipelineLayout / WGSL @group(0)@binding(0) var<uniform> mvp: mat4x4<f32> /
//      passEncoder.setBindGroup(0, bg) + 动态偏移 setBindGroup(0, bg, [dynamicOffset])）
//   4) 采样纹理与采样器（device.createTexture TEXTURE_BINDING|COPY_DST|RENDER_ATTACHMENT / queue.writeTexture /
//      texture.createView() / device.createSampler{magFilter, minFilter, addressModeU} /
//      bindGroupLayout: texture{viewDimension, sampleType} + sampler{type:'filtering'} /
//      WGSL var t: texture_2d<f32>; var s: sampler; textureSample(t, s, uv)）
//   5) 深度/模板附件与渲染通道（device.createTexture format:'depth24plus' usage:RENDER_ATTACHMENT /
//      renderPipeline.depthStencil{format, depthWriteEnabled, depthCompare} /
//      beginRenderPass{colorAttachments[{view, loadOp:'clear', storeOp:'store', clearValue}], depthStencilAttachment{view, depthClearValue, depthLoadOp, depthStoreOp}} /
//      depthCompare: never|less|less-equal|equal|greater...）
//   6) 多重采样与 RenderBundle（renderPipeline.multisample{count:4} / MSAA colorAttachment view + resolveTarget /
//      device.createRenderBundleEncoder{colorFormats, depthStencilFormat} → bundleEncoder.draw → finish → passEncoder.executeBundles([bundle])）
//   7) 上下文配置与设备丢失（canvas.getContext('webgpu') → context.configure{device, format, alphaMode} /
//      navigator.gpu.getPreferredCanvasFormat() → 'bgra8unorm'|'rgba8unorm' / alphaMode: 'opaque'|'premultiplied' /
//      WebGL webglcontextlost/webglcontextrestored vs WebGPU device.lost Promise{reason, message} / 资源重建策略）
// 说明：WebGPU 是 WebGL 的继任者，提供显式 GPU 资源管理与现代渲染管线（render pipeline）能力。
//   所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
//   jsdom/Node 中 navigator.gpu 已 polyfill，但 GPUBufferUsage/GPUShaderStage/GPUMapMode/GPUTextureUsage
//   常量对象可能未定义，本页提供本地回退常量（位掩码值与 WebGPU 规范一致）。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// —— 本地回退常量：当全局 GPUBufferUsage / GPUShaderStage / GPUMapMode / GPUTextureUsage 未定义时使用（位掩码值与 WebGPU 规范一致）——
const FALLBACK_GPUBufferUsage = {
  MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8,
  INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128,
  INDIRECT: 256, QUERY_RESOLVE: 512,
};
const FALLBACK_GPUShaderStage = { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
const FALLBACK_GPUMapMode = { READ: 1, WRITE: 2 };
const FALLBACK_GPUTextureUsage = {
  COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4,
  STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16,
};

// 取活跃的常量对象（优先全局，回退本地）
const _bufferUsage = () => (typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage : FALLBACK_GPUBufferUsage);
const _shaderStage = () => (typeof GPUShaderStage !== 'undefined' ? GPUShaderStage : FALLBACK_GPUShaderStage);
const _mapMode = () => (typeof GPUMapMode !== 'undefined' ? GPUMapMode : FALLBACK_GPUMapMode);
const _textureUsage = () => (typeof GPUTextureUsage !== 'undefined' ? GPUTextureUsage : FALLBACK_GPUTextureUsage);

// —— WGSL 着色器：简单三角形（顶点位置 → 红色片元），演示 vertex buffer 与属性 ——
// @vertex 标记顶点入口；@location(0) 对应 vertexLayout.attributes[0].shaderLocation=0；
// @builtin(position) 是裁剪空间输出；@fragment 标记片元入口；@location(0) 是颜色附件 0 的输出。
const TRIANGLE_WGSL = `
@vertex
fn vs_main(@location(0) pos: vec3<f32>) -> @builtin(position) vec4<f32> {
  return vec4<f32>(pos, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 0.2, 0.3, 1.0);
}
`;

// —— WGSL 着色器：Uniform Buffer（MVP 矩阵），演示 uniform 绑定与动态偏移 ——
const UNIFORM_WGSL = `
@group(0) @binding(0) var<uniform> mvp: mat4x4<f32>;

@vertex
fn vs_main(@location(0) pos: vec3<f32>) -> @builtin(position) vec4<f32> {
  return mvp * vec4<f32>(pos, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(0.2, 0.8, 0.4, 1.0);
}
`;

// —— WGSL 着色器：采样纹理与采样器，演示 texture_2d + sampler + textureSample ——
const TEXTURE_WGSL = `
@group(0) @binding(0) var t: texture_2d<f32>;
@group(0) @binding(1) var s: sampler;

@vertex
fn vs_main(@location(0) pos: vec3<f32>, @location(1) uv: vec2<f32>) -> @builtin(position) vec4<f32> {
  return vec4<f32>(pos, 1.0);
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let c = textureSample(t, s, uv);
  return c;
}
`;

// GPUPrimitiveTopology 取值对照
const PRIMITIVE_TOPOLOGIES = ['triangle-list', 'line-list', 'point-list', 'triangle-strip', 'line-strip'];

// GPUCompareFunction（depthCompare）取值对照
const DEPTH_COMPARE_FUNCS = [
  'never', 'less', 'equal', 'less-equal',
  'greater', 'not-equal', 'greater-equal', 'always',
];

// 顶点属性 format 常见取值
const VERTEX_FORMATS = [
  'float32x3', 'float32x2', 'float32x4', 'float32',
  'unorm8x4', 'sint16x2', 'uint16x4',
];

export class WebGPURenderPipelinePage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      vertexInfo: '',     // Card 1：顶点缓冲与属性
      indexInfo: '',      // Card 2：索引缓冲与绘制
      uniformInfo: '',    // Card 3：Uniform 缓冲与 BindGroup
      textureInfo: '',    // Card 4：采样纹理与采样器
      depthInfo: '',      // Card 5：深度/模板附件与渲染通道
      msaaInfo: '',       // Card 6：多重采样与 RenderBundle
      contextInfo: '',    // Card 7：上下文配置与设备丢失
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._adapter = null; this._device = null;
    this._vertexBuffer = null; this._indexBuffer = null; this._uniformBuffer = null;
    this._texture = null; this._depthTexture = null; this._msaaTexture = null;
    this._colorTexture = null; this._sampler = null;
    this._bindGroupLayout = null; this._pipelineLayout = null; this._bindGroup = null;
    this._shaderModule = null; this._pipeline = null; this._renderBundle = null;
    this._canvas = null; this._context = null; this._deviceLostHandler = null;

    // 一次性能力检测：navigator.gpu 全家桶
    const caps = this._caps();
    const parts = [
      `navigator.gpu ${caps.gpu ? '✓' : '✗'}`,
      `requestAdapter ${caps.requestAdapter ? '✓' : '✗'}`,
      `GPUBufferUsage ${caps.bufferUsage ? '✓' : '✗（用本地回退）'}`,
      `GPUShaderStage ${caps.shaderStage ? '✓' : '✗（用本地回退）'}`,
      `GPUMapMode ${caps.mapMode ? '✓' : '✗（用本地回退）'}`,
      `GPUTextureUsage ${caps.textureUsage ? '✓' : '✗（用本地回退）'}`,
      `getPreferredCanvasFormat ${caps.getPreferredCanvasFormat ? '✓' : '✗'}`,
    ];

    const summary = caps.gpu
      ? `WebGPU 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）navigator.gpu 已 polyfill，可演示 requestAdapter / createBuffer / createTexture / createSampler / createRenderPipeline / beginRenderPass / createRenderBundleEncoder 等渲染管线流程；GPUBufferUsage/GPUTextureUsage 等常量对象若未定义则用本地回退值（与规范位掩码一致）。`
      : '当前环境不支持 WebGPU（navigator.gpu 未定义）；所有按钮点击将仅记日志说明，不会抛异常。在支持 WebGPU 的浏览器（Chrome 113+/Edge 113+）中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(caps.gpu ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.bufferUsage) this._addLog('warn', 'GPUBufferUsage 未定义，使用本地回退常量（位掩码值与规范一致）');
    if (!caps.shaderStage) this._addLog('warn', 'GPUShaderStage 未定义，使用本地回退常量');
    if (!caps.mapMode) this._addLog('warn', 'GPUMapMode 未定义，使用本地回退常量');
    if (!caps.textureUsage) this._addLog('warn', 'GPUTextureUsage 未定义，使用本地回退常量');
  }

  componentWillUnmount() {
    // 释放 GPU 资源：buffer.destroy() / texture.destroy() / device.destroy()，每个调用包 try/catch
    try { if (this._vertexBuffer && typeof this._vertexBuffer.destroy === 'function') this._vertexBuffer.destroy(); } catch { /* noop */ }
    try { if (this._indexBuffer && typeof this._indexBuffer.destroy === 'function') this._indexBuffer.destroy(); } catch { /* noop */ }
    try { if (this._uniformBuffer && typeof this._uniformBuffer.destroy === 'function') this._uniformBuffer.destroy(); } catch { /* noop */ }
    try { if (this._texture && typeof this._texture.destroy === 'function') this._texture.destroy(); } catch { /* noop */ }
    try { if (this._depthTexture && typeof this._depthTexture.destroy === 'function') this._depthTexture.destroy(); } catch { /* noop */ }
    try { if (this._msaaTexture && typeof this._msaaTexture.destroy === 'function') this._msaaTexture.destroy(); } catch { /* noop */ }
    try { if (this._colorTexture && typeof this._colorTexture.destroy === 'function') this._colorTexture.destroy(); } catch { /* noop */ }
    try {
      if (this._device && typeof this._device.destroy === 'function') this._device.destroy();
    } catch { /* noop */ }
    // 解绑 device.lost 监听（若有）
    if (this._deviceLostHandler && this._device && typeof this._device.removeEventListener === 'function') {
      try { this._device.removeEventListener('lost', this._deviceLostHandler); } catch { /* noop */ }
    }
    this._adapter = this._device = null;
    this._vertexBuffer = this._indexBuffer = this._uniformBuffer = null;
    this._texture = this._depthTexture = this._msaaTexture = this._colorTexture = null;
    this._sampler = null;
    this._bindGroupLayout = this._pipelineLayout = this._bindGroup = null;
    this._shaderModule = this._pipeline = this._renderBundle = null;
    this._canvas = this._context = this._deviceLostHandler = null;
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
    const hasGpu = typeof navigator !== 'undefined' && navigator.gpu;
    return {
      gpu: hasGpu,
      requestAdapter: hasGpu && typeof navigator.gpu.requestAdapter === 'function',
      bufferUsage: typeof GPUBufferUsage !== 'undefined',
      shaderStage: typeof GPUShaderStage !== 'undefined',
      mapMode: typeof GPUMapMode !== 'undefined',
      textureUsage: typeof GPUTextureUsage !== 'undefined',
      getPreferredCanvasFormat: hasGpu && typeof navigator.gpu.getPreferredCanvasFormat === 'function',
    };
  }

  // —— 共享：确保已获取 device（多卡片复用）——
  async _ensureDevice() {
    if (this._device) return this._device;
    if (!this._caps().gpu) return null;
    if (!this._adapter) {
      this._adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    }
    if (!this._adapter) return null;
    this._device = await this._adapter.requestDevice({ label: 'webgpu-render-lab' });
    return this._device;
  }

  // —— 共享：获取 canvas format（回退 'bgra8unorm'）——
  _canvasFormat() {
    if (this._caps().getPreferredCanvasFormat) {
      try { return navigator.gpu.getPreferredCanvasFormat(); } catch { /* noop */ }
    }
    return 'bgra8unorm';
  }

  // =================== Card 1：顶点缓冲与属性 ===================

  // device.createBuffer(VERTEX|COPY_DST) + queue.writeBuffer + GPUVertexBufferLayout + createRenderPipeline.vertex + setVertexBuffer
  async _createVertexPipeline() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      const BU = _bufferUsage();
      const SS = _shaderStage();
      // 3 个顶点构成一个三角形，每顶点 3 个 float (x, y, z)，arrayStride = 12 字节
      const vertices = new Float32Array([
        0.0,  0.6, 0.0,   // 顶点 0：顶部
        -0.6, -0.4, 0.0,  // 顶点 1：左下
         0.6, -0.4, 0.0,  // 顶点 2：右下
      ]);
      const byteLength = vertices.byteLength; // 36
      this._addLog('vertex', `createBuffer(VERTEX|COPY_DST, size=${byteLength})…`);
      const vertexBuffer = device.createBuffer({
        label: 'vertex-buffer',
        size: byteLength,
        usage: BU.VERTEX | BU.COPY_DST,
      });
      this._vertexBuffer = vertexBuffer;
      device.queue.writeBuffer(vertexBuffer, 0, vertices);
      this._addLog('vertex', `queue.writeBuffer 写入 3 顶点（9 个 f32，arrayStride=12B）`);

      // GPUVertexBufferLayout：arrayStride + attributes[{shaderLocation, offset, format}]
      const vertexLayout = {
        arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT, // 12
        stepMode: 'vertex',
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
      };

      const module = device.createShaderModule({ label: 'triangle-shader', code: TRIANGLE_WGSL });
      this._shaderModule = module;
      const format = this._canvasFormat();
      this._addLog('pipeline', `createRenderPipeline({ vertex:{ module, entryPoint, buffers:[layout] }, fragment:{...}, primitive:{} })…`);
      const pipeline = device.createRenderPipeline({
        label: 'triangle-pipeline',
        layout: 'auto',
        vertex: { module, entryPoint: 'vs_main', buffers: [vertexLayout] },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      this._pipeline = pipeline;

      this.setState({
        vertexInfo:
          `device.createBuffer({ size: ${byteLength}, usage: VERTEX|COPY_DST }) → GPUBuffer\n` +
          `  GPUBufferUsage 位掩码：VERTEX=${BU.VERTEX}, COPY_DST=${BU.COPY_DST}，usage=${BU.VERTEX | BU.COPY_DST}（按位或）\n\n` +
          `device.queue.writeBuffer(vertexBuffer, 0, Float32Array[9]) 写入 3 顶点：\n` +
          `  [0.0, 0.6, 0.0] / [-0.6, -0.4, 0.0] / [0.6, -0.4, 0.0]\n\n` +
          `GPUVertexBufferLayout（renderPipeline.vertex.buffers[0]）：\n` +
          `  arrayStride = ${vertexLayout.arrayStride}（每顶点字节数，3×4=12）\n` +
          `  stepMode = '${vertexLayout.stepMode}'（'vertex' 每顶点推进，'instance' 每实例推进）\n` +
          `  attributes[0]: { shaderLocation: 0, offset: 0, format: 'float32x3' }\n` +
          `    shaderLocation 对应 WGSL @location(0)；offset 是属性在顶点内偏移；format 取 'float32x3'/'float32x2' 等\n\n` +
          `renderPipeline descriptor 的 vertex 字段：\n` +
          `  vertex: { module, entryPoint: 'vs_main', buffers: [vertexLayout] }\n` +
          `  buffers[slot] 对应 passEncoder.setVertexBuffer(slot, buffer) 的 slot —— buffers[0] ↔ setVertexBuffer(0, ...)\n\n` +
          `已创建 renderPipeline：label=${pipeline.label}，fragment.targets[0].format='${format}'\n\n` +
          `passEncoder.setVertexBuffer(0, vertexBuffer) —— slot 0 绑定到 buffers[0] 对应的 vertexLayout`,
      });
      this._addLog('pipeline', `renderPipeline 创建成功：label=${pipeline.label}，vertex buffers=[1 layout]`);
    } catch (err) {
      this._addLog('warn', `顶点管线创建失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. 顶点缓冲与属性（Vertex Buffer & Attributes）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'createBuffer ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'VERTEX | COPY_DST'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createBuffer({ size, usage: GPUBufferUsage.VERTEX | COPY_DST }) 创建顶点缓冲；queue.writeBuffer(vertexBuffer, 0, Float32Array) 写入顶点数据。GPUVertexBufferLayout 定义属性布局：arrayStride（每顶点字节数）、stepMode（"vertex"|"instance"）、attributes[{ shaderLocation, offset, format }]，format 取 float32x3/float32x2 等。renderPipeline descriptor 的 vertex: { module, entryPoint, buffers: [vertexLayout] }，buffers[slot] 对应 passEncoder.setVertexBuffer(slot, buffer) 的 slot。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建顶点缓冲与管线', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createVertexPipeline() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '顶点缓冲 / 布局 / 管线：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.vertexInfo || '（点击「创建顶点缓冲与管线」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`const vbo = device.createBuffer({ size: 36, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(vbo, 0, new Float32Array([0,0.6,0, -0.6,-0.4,0, 0.6,-0.4,0]));
const layout = { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] };
const pipeline = device.createRenderPipeline({
  vertex: { module, entryPoint: 'vs_main', buffers: [layout] },   // buffers[0] ↔ slot 0
  fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
  primitive: { topology: 'triangle-list' },
});
passEncoder.setVertexBuffer(0, vbo);   // slot 0 对应 buffers[0]`)),
        h(Alert, {
          type: 'info',
          message: 'shaderLocation 是 WGSL @location(N) 的对应，offset 是属性在顶点内的字节偏移',
          description: '一个顶点可含多个属性（位置+法线+uv）：arrayStride = 所有属性字节总和，每个属性指定 offset 与 format。setVertexBuffer(slot, buf) 的 slot 索引 renderPipeline.vertex.buffers[slot] 数组。stepMode:"instance" 用于实例化（每实例推进一次）。常见 format：float32x3/float32x2/float32x4/unorm8x4 等。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：索引缓冲与绘制 ===================

  // device.createBuffer(INDEX|COPY_DST) + queue.writeBuffer(Uint16Array) + setIndexBuffer + drawIndexed vs draw
  async _createIndexPipeline() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      const BU = _bufferUsage();
      // 两个三角形构成四边形：4 顶点 + 6 索引
      const vertices = new Float32Array([
        -0.6, -0.5, 0.0,  0.6, -0.5, 0.0,  0.6, 0.5, 0.0,  -0.6, 0.5, 0.0,
      ]);
      const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
      const vbo = this._vertexBuffer || device.createBuffer({
        label: 'quad-vbo', size: vertices.byteLength, usage: BU.VERTEX | BU.COPY_DST,
      });
      if (!this._vertexBuffer) {
        this._vertexBuffer = vbo;
        device.queue.writeBuffer(vbo, 0, vertices);
      }
      this._addLog('index', `createBuffer(INDEX|COPY_DST, size=${indices.byteLength})…`);
      const indexBuffer = device.createBuffer({
        label: 'index-buffer',
        size: indices.byteLength, // 12
        usage: BU.INDEX | BU.COPY_DST,
      });
      this._indexBuffer = indexBuffer;
      device.queue.writeBuffer(indexBuffer, 0, indices);
      this._addLog('index', `queue.writeBuffer 写入 6 个 uint16 索引：[${Array.from(indices).join(', ')}]`);

      const module = this._shaderModule || device.createShaderModule({ label: 'quad-shader', code: TRIANGLE_WGSL });
      const format = this._canvasFormat();
      const pipeline = device.createRenderPipeline({
        label: 'quad-pipeline',
        layout: 'auto',
        vertex: {
          module, entryPoint: 'vs_main',
          buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }],
        },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      this._pipeline = pipeline;

      this.setState({
        indexInfo:
          `device.createBuffer({ size: ${indices.byteLength}, usage: INDEX|COPY_DST }) → GPUBuffer\n` +
          `  GPUBufferUsage 位掩码：INDEX=${BU.INDEX}, COPY_DST=${BU.COPY_DST}，usage=${BU.INDEX | BU.COPY_DST}\n\n` +
          `device.queue.writeBuffer(indexBuffer, 0, Uint16Array[6]) 写入索引：[${Array.from(indices).join(', ')}]\n` +
          `  两个三角形（0,1,2）与（0,2,3）复用 4 顶点构成四边形（省去重复顶点）\n\n` +
          `passEncoder.setIndexBuffer(indexBuffer, 'uint16')：\n` +
          `  format 必须是 'uint16' 或 'uint32'（与索引数据类型匹配），不可省略\n\n` +
          `drawIndexed vs draw 对照：\n` +
          `  passEncoder.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance)\n` +
          `    → drawIndexed(6, 1, 0, 0, 0)：绘制 6 个索引（2 个三角形），1 实例\n` +
          `    baseVertex：索引值整体偏移（indexBuffer 中的 i 实际访问 baseVertex + i）\n` +
          `  passEncoder.draw(vertexCount, instanceCount, firstVertex, firstInstance)\n` +
          `    → draw(4, 1, 0, 0)：按顶点顺序绘制 4 顶点（无索引复用，topology 决定如何连成图元）\n\n` +
          `GPUPrimitiveTopology（primitive.topology）取值：\n` +
          PRIMITIVE_TOPOLOGIES.map((t) => `  • ${t}`).join('\n') + '\n' +
          `  默认 'triangle-list'；'triangle-strip' 用 strip-index-format 自动连接相邻顶点\n\n` +
          `已创建 pipeline：label=${pipeline.label}，topology='triangle-list'`,
      });
      this._addLog('index', `索引缓冲创建成功：6 索引（uint16），可用 drawIndexed(6,1,0,0,0)`);
    } catch (err) {
      this._addLog('warn', `索引管线创建失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. 索引缓冲与绘制（Index Buffer & Draw）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'drawIndexed ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'INDEX | uint16/uint32'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createBuffer({ usage: GPUBufferUsage.INDEX | COPY_DST }) 创建索引缓冲；queue.writeBuffer(indexBuffer, 0, Uint16Array) 写入索引。passEncoder.setIndexBuffer(indexBuffer, format) 绑定，format 必须是 "uint16" 或 "uint32"（与数据类型匹配）。passEncoder.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance) 按索引绘制；passEncoder.draw(vertexCount, instanceCount, firstVertex, firstInstance) 按顶点顺序绘制。GPUPrimitiveTopology：triangle-list(默认)/line-list/point-list/triangle-strip/line-strip。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建索引缓冲与管线', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createIndexPipeline() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '索引缓冲 / drawIndexed / 拓扑：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.indexInfo || '（点击「创建索引缓冲与管线」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`const ibo = device.createBuffer({ size: 12, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(ibo, 0, new Uint16Array([0, 1, 2, 0, 2, 3]));
passEncoder.setIndexBuffer(ibo, 'uint16');     // format 必填：'uint16' | 'uint32'
passEncoder.drawIndexed(6, 1, 0, 0, 0);        // indexCount, instCount, firstIdx, baseVertex, firstInst
// 无索引时：passEncoder.draw(vertexCount, instanceCount, firstVertex, firstInstance);
// primitive: { topology: 'triangle-list' } // 默认；'line-list'/'point-list'/'triangle-strip'`)),
        h(Alert, {
          type: 'info',
          message: '索引缓冲复用顶点，减少数据量；baseVertex 可整体偏移索引访问',
          description: 'drawIndexed 的 baseVertex 让索引 i 实际访问 baseVertex+i 号顶点，便于把多个网格合并到一个 vbo 中。firstInstance 配合实例化绘制（instance buffer）。topology 决定顶点如何被组装成图元：triangle-list 每 3 顶点一个三角形，triangle-strip 相邻 3 顶点共享。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Uniform 缓冲与 BindGroup ===================

  // device.createBuffer(UNIFORM|COPY_DST) + createBindGroupLayout + createPipelineLayout + createBindGroup + 动态偏移
  async _createUniformBindGroup() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      const BU = _bufferUsage();
      const SS = _shaderStage();
      // mat4x4<f32> = 16 个 f32 = 64 字节；动态偏移需按 minUniformBufferOffsetAlignment 对齐
      const matSize = 16 * Float32Array.BYTES_PER_ELEMENT; // 64
      const minAlign = (device.limits && device.limits.minUniformBufferOffsetAlignment) || 256;
      // 用 2 个矩阵的 uniform buffer 演示动态偏移（每段对齐到 minAlign）
      const segSize = Math.ceil(matSize / minAlign) * minAlign || minAlign;
      const uniformSize = segSize * 2;
      this._addLog('uniform', `createBuffer(UNIFORM|COPY_DST, size=${uniformSize}, minAlign=${minAlign})…`);
      const uniformBuffer = device.createBuffer({
        label: 'uniform-buffer',
        size: uniformSize,
        usage: BU.UNIFORM | BU.COPY_DST,
      });
      this._uniformBuffer = uniformBuffer;
      // 写入 2 个 MVP 矩阵（单位矩阵演示）
      const identity = new Float32Array(16);
      identity[0] = 1; identity[5] = 1; identity[10] = 1; identity[15] = 1;
      device.queue.writeBuffer(uniformBuffer, 0, identity);
      device.queue.writeBuffer(uniformBuffer, segSize, identity);

      this._addLog('bind', "createBindGroupLayout({ buffer:{ type:'uniform', hasDynamicOffset:true } })…");
      const bindGroupLayout = device.createBindGroupLayout({
        label: 'uniform-bgl',
        entries: [{
          binding: 0,
          visibility: SS.VERTEX | SS.FRAGMENT,
          buffer: { type: 'uniform', hasDynamicOffset: true },
        }],
      });
      this._bindGroupLayout = bindGroupLayout;
      const pipelineLayout = device.createPipelineLayout({ label: 'uniform-pll', bindGroupLayouts: [bindGroupLayout] });
      this._pipelineLayout = pipelineLayout;
      this._addLog('bind', `createBindGroup({ layout, entries:[{ binding:0, resource:{ buffer, offset:0, size:${matSize} } }] })…`);
      const bindGroup = device.createBindGroup({
        label: 'uniform-bg',
        layout: bindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer, offset: 0, size: matSize } }],
      });
      this._bindGroup = bindGroup;

      this.setState({
        uniformInfo:
          `device.createBuffer({ size: ${uniformSize}, usage: UNIFORM|COPY_DST }) → GPUBuffer\n` +
          `  GPUBufferUsage 位掩码：UNIFORM=${BU.UNIFORM}, COPY_DST=${BU.COPY_DST}，usage=${BU.UNIFORM | BU.COPY_DST}\n` +
          `  uniform buffer 存放 mat4x4<f32>（16×4=64 字节）\n\n` +
          `Uniform 对齐规则：\n` +
          `  - WGSL vec4/mat4x4 按 16 字节对齐（struct 内成员需 16 字节对齐）\n` +
          `  - device.limits.minUniformBufferOffsetAlignment = ${minAlign}（通常 256），动态偏移必须是该值倍数\n` +
          `  - 本 buffer 容纳 2 段矩阵，每段 ${segSize} 字节（按 ${minAlign} 对齐）\n\n` +
          `device.createBindGroupLayout({ entries:[{ binding:0, visibility: VERTEX|FRAGMENT, buffer:{ type:'uniform', hasDynamicOffset: true } }] })\n` +
          `  GPUShaderStage.VERTEX|FRAGMENT = ${SS.VERTEX | SS.FRAGMENT}（按位或，顶点+片元均可见）\n` +
          `  buffer.type 取值：'uniform' | 'storage' | 'read-only-storage'\n` +
          `  hasDynamicOffset:true 允许 setBindGroup 时传入动态偏移（一个 bindGroup 复用多个 uniform 段）\n\n` +
          `device.createPipelineLayout({ bindGroupLayouts:[bgl] }) → GPUPipelineLayout\n` +
          `  bindGroupLayouts 按 group index 组织，对应 WGSL @group(0)/@group(1)\n\n` +
          `device.createBindGroup({ layout, entries:[{ binding:0, resource:{ buffer, offset:0, size:${matSize} } }] })\n` +
          `  resource.size 必须显式指定（uniform 段大小）\n\n` +
          `WGSL 声明：@group(0) @binding(0) var<uniform> mvp: mat4x4<f32>;\n\n` +
          `passEncoder.setBindGroup(0, bindGroup) —— 静态绑定（offset 0）\n` +
          `passEncoder.setBindGroup(0, bindGroup, [dynamicOffset]) —— 动态偏移\n` +
          `  dynamicOffset 必须是 minUniformBufferOffsetAlignment(${minAlign}) 的倍数；\n` +
          `  如 [${segSize}] 访问第 2 段矩阵，实现「一个 bindGroup 绘制多个对象」`,
      });
      this._addLog('bind', `Uniform BindGroup 创建成功：hasDynamicOffset=true，minAlign=${minAlign}`);
    } catch (err) {
      this._addLog('warn', `Uniform BindGroup 创建失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. Uniform 缓冲与 BindGroup（Uniform Buffer）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'UNIFORM ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'hasDynamicOffset'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createBuffer({ usage: GPUBufferUsage.UNIFORM | COPY_DST }) 创建 uniform 缓冲；WGSL vec4/mat4x4 按 16 字节对齐，device.limits.minUniformBufferOffsetAlignment（通常 256）约束动态偏移对齐。createBindGroupLayout({ entries:[{ binding, visibility: VERTEX|FRAGMENT, buffer:{ type:"uniform", hasDynamicOffset } }] })，createPipelineLayout({ bindGroupLayouts }) 组织布局。WGSL：@group(0) @binding(0) var<uniform> mvp: mat4x4<f32>;。passEncoder.setBindGroup(0, bg) 静态绑定，setBindGroup(0, bg, [dynamicOffset]) 动态偏移（一个 bindGroup 复用多个 uniform 段）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 Uniform BindGroup', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createUniformBindGroup() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Uniform 缓冲 / 布局 / 动态偏移：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.uniformInfo || '（点击「创建 Uniform BindGroup」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'WGSL uniform 声明（UNIFORM_WGSL）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {}, UNIFORM_WGSL.trim())),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } },
          h('code', {},
`const ubo = device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(ubo, 0, mvpMatrix);                  // 64 字节 mat4x4
const bgl = device.createBindGroupLayout({ entries: [
  { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform', hasDynamicOffset: true } },
] });
const pll = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
const bg = device.createBindGroup({ layout: bgl, entries: [
  { binding: 0, resource: { buffer: ubo, offset: 0, size: 64 } },
] });
passEncoder.setBindGroup(0, bg, [256]);   // 动态偏移访问第 2 段（须 256 对齐）`)),
        h(Alert, {
          type: 'warning',
          message: '动态偏移必须是 minUniformBufferOffsetAlignment 的倍数',
          description: 'hasDynamicOffset:true 时 setBindGroup 传入 dynamicOffsets 数组，每个偏移须是 minUniformBufferOffsetAlignment（通常 256）的倍数。这样可用一个 uniform buffer 容纳多个对象的 MVP 矩阵，一次 bindGroup 多次 draw 不同偏移，减少 bindGroup 创建数量。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：采样纹理与采样器 ===================

  // createTexture(TEXTURE_BINDING|COPY_DST|RENDER_ATTACHMENT) + writeTexture + createView + createSampler + bindGroup
  async _createSampledTexture() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      const TU = _textureUsage();
      const SS = _shaderStage();
      const W = 4, H = 4;
      // 4x4 rgba8unorm 纹理（每像素 4 字节）
      const texFormat = 'rgba8unorm';
      const pixelBytes = 4;
      const data = new Uint8Array(W * H * pixelBytes);
      for (let i = 0; i < W * H; i++) { data[i * 4] = 255; data[i * 4 + 1] = 128; data[i * 4 + 2] = 64; data[i * 4 + 3] = 255; }
      this._addLog('texture', `createTexture(${W}x${H}, ${texFormat}, TEXTURE_BINDING|COPY_DST|RENDER_ATTACHMENT)…`);
      const texture = device.createTexture({
        label: 'sampled-texture',
        size: [W, H, 1],
        format: texFormat,
        usage: TU.TEXTURE_BINDING | TU.COPY_DST | TU.RENDER_ATTACHMENT,
      });
      this._texture = texture;
      device.queue.writeTexture(
        { texture, mipLevel: 0, origin: [0, 0, 0] },
        data,
        { offset: 0, bytesPerRow: W * pixelBytes, rowsPerImage: H },
        { width: W, height: H, depthOrArrayLayers: 1 },
      );
      this._addLog('texture', `queue.writeTexture 写入 ${W}x${H} rgba8 数据（bytesPerRow=${W * pixelBytes}）`);
      const view = texture.createView({ label: 'tex-view', dimension: '2d', format: texFormat });

      this._addLog('sampler', "createSampler({ magFilter:'linear', minFilter:'linear', addressModeU:'repeat' })…");
      const sampler = device.createSampler({
        label: 'linear-sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'repeat',
        addressModeV: 'clamp-to-edge',
        addressModeW: 'repeat',
      });
      this._sampler = sampler;

      this._addLog('bind', "createBindGroupLayout({ texture + sampler entries })…");
      const bindGroupLayout = device.createBindGroupLayout({
        label: 'texture-bgl',
        entries: [
          { binding: 0, visibility: SS.FRAGMENT, texture: { viewDimension: '2d', sampleType: 'float' } },
          { binding: 1, visibility: SS.FRAGMENT, sampler: { type: 'filtering' } },
        ],
      });
      this._bindGroupLayout = bindGroupLayout;
      const bindGroup = device.createBindGroup({
        label: 'texture-bg',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: view },
          { binding: 1, resource: sampler },
        ],
      });
      this._bindGroup = bindGroup;

      this.setState({
        textureInfo:
          `device.createTexture({ size:[${W},${H},1], format:'${texFormat}', usage: TEXTURE_BINDING|COPY_DST|RENDER_ATTACHMENT }) → GPUTexture\n` +
          `  GPUTextureUsage 位掩码：TEXTURE_BINDING=${TU.TEXTURE_BINDING}, COPY_DST=${TU.COPY_DST}, RENDER_ATTACHMENT=${TU.RENDER_ATTACHMENT}\n` +
          `  usage=${TU.TEXTURE_BINDING | TU.COPY_DST | TU.RENDER_ATTACHMENT}（按位或）\n\n` +
          `device.queue.writeTexture({ texture, mipLevel:0, origin:[0,0,0] }, data, { bytesPerRow:${W * pixelBytes}, rowsPerImage:${H} }, { width:${W}, height:${H} })\n` +
          `  GPUImageCopyTexture：{ texture, mipLevel, origin }\n` +
          `  GPUImageDataLayout：{ offset, bytesPerRow（须 256 对齐）, rowsPerImage }\n` +
          `  GPUExtent3D：{ width, height, depthOrArrayLayers }\n\n` +
          `texture.createView({ dimension:'2d', format:'${texFormat}' }) → GPUTextureView\n\n` +
          `device.createSampler({ magFilter, minFilter, mipmapFilter, addressModeU/V/W }) → GPUSampler\n` +
          `  magFilter/minFilter/mipmapFilter：'nearest' | 'linear'\n` +
          `  addressModeU/V/W：'clamp-to-edge' | 'repeat' | 'mirror-repeat'\n\n` +
          `BindGroupLayout entries：\n` +
          `  [0]: { binding:0, visibility:FRAGMENT, texture:{ viewDimension:'2d', sampleType:'float' } }\n` +
          `      sampleType 取值：'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint'\n` +
          `  [1]: { binding:1, visibility:FRAGMENT, sampler:{ type:'filtering' } }\n` +
          `      sampler.type 取值：'filtering' | 'non-filtering' | 'comparison'\n\n` +
          `BindGroup entries：\n` +
          `  [0]: { binding:0, resource: view }（GPUTextureView）\n` +
          `  [1]: { binding:1, resource: sampler }（GPUSampler）\n\n` +
          `WGSL（TEXTURE_WGSL）：\n` +
          `  @group(0) @binding(0) var t: texture_2d<f32>;\n` +
          `  @group(0) @binding(1) var s: sampler;\n` +
          `  fn fs_main(@location(0) uv: vec2<f32>) { let c = textureSample(t, s, uv); }`,
      });
      this._addLog('texture', `采样纹理 BindGroup 创建成功：texture@0 + sampler@1`);
    } catch (err) {
      this._addLog('warn', `采样纹理创建失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. 采样纹理与采样器（Sampled Texture & Sampler）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'textureSample ✓' : '不可用'),
        h(Tag, { color: caps.primary ? 'primary' : 'primary' }, 'TEXTURE_BINDING | sampler'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createTexture({ size, format, usage: GPUTextureUsage.TEXTURE_BINDING | COPY_DST | RENDER_ATTACHMENT }) 创建可采样纹理；queue.writeTexture({ texture }, data, { bytesPerRow, rowsPerImage }, { width, height }) 写入像素数据；texture.createView() 创建纹理视图。device.createSampler({ magFilter, minFilter, addressModeU }) 创建采样器。BindGroupLayout entry：texture:{ viewDimension:"2d", sampleType:"float" } 与 sampler:{ type:"filtering" }。WGSL：var t: texture_2d<f32>; var s: sampler; textureSample(t, s, uv) 在片元着色器中采样。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建纹理与采样器', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createSampledTexture() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '采样纹理 / 采样器 / BindGroup：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.textureInfo || '（点击「创建纹理与采样器」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'WGSL 采样代码（TEXTURE_WGSL）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {}, TEXTURE_WGSL.trim())),
        h(Alert, {
          type: 'info',
          message: 'textureSample 仅可在片元着色器调用；顶点着色器用 textureLoad',
          description: 'textureSample 依赖屏幕空间导数计算 mipmap level，故只能在 @fragment 中使用。@vertex 中读取纹理用 textureLoad(t, coord, level)（无 filtering，整数坐标）。sampler.type:"filtering" 配合 linear filter；"comparison" 用于阴影贴图（PCF）。addressModeU/V/W 控制超出 [0,1] 范围的寻址方式。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：深度/模板附件与渲染通道 ===================

  // createTexture('depth24plus', RENDER_ATTACHMENT) + depthStencil + beginRenderPass with depthStencilAttachment
  async _createDepthRenderPass() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      const TU = _textureUsage();
      const depthFormat = 'depth24plus';
      const W = 64, H = 64;
      this._addLog('depth', `createTexture(${W}x${H}, '${depthFormat}', RENDER_ATTACHMENT)…`);
      const depthTexture = device.createTexture({
        label: 'depth-texture',
        size: [W, H, 1],
        format: depthFormat,
        usage: TU.RENDER_ATTACHMENT,
      });
      this._depthTexture = depthTexture;
      const depthView = depthTexture.createView();
      // 颜色附件纹理（无需 canvas，用 RENDER_ATTACHMENT texture 演示）
      const colorFormat = this._canvasFormat();
      const colorTexture = device.createTexture({
        label: 'color-texture',
        size: [W, H, 1],
        format: colorFormat,
        usage: TU.RENDER_ATTACHMENT | TU.COPY_SRC,
      });
      this._colorTexture = colorTexture;
      const colorView = colorTexture.createView();

      const module = this._shaderModule || device.createShaderModule({ label: 'depth-shader', code: TRIANGLE_WGSL });
      this._addLog('pipeline', `createRenderPipeline({ depthStencil:{ format, depthWriteEnabled, depthCompare:'less' } })…`);
      const pipeline = device.createRenderPipeline({
        label: 'depth-pipeline',
        layout: 'auto',
        vertex: { module, entryPoint: 'vs_main', buffers: [] },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format: colorFormat }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: {
          format: depthFormat,
          depthWriteEnabled: true,
          depthCompare: 'less',
        },
      });
      this._pipeline = pipeline;

      this._addLog('pass', "beginRenderPass({ colorAttachments + depthStencilAttachment })…");
      const encoder = device.createCommandEncoder({ label: 'depth-encoder' });
      const passEncoder = encoder.beginRenderPass({
        label: 'depth-pass',
        colorAttachments: [{
          view: colorView,
          clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
          stencilClearValue: 0,
          stencilLoadOp: 'clear',
          stencilStoreOp: 'store',
        },
      });
      passEncoder.setPipeline(pipeline);
      if (this._vertexBuffer) passEncoder.setVertexBuffer(0, this._vertexBuffer);
      passEncoder.draw(3, 1, 0, 0);
      passEncoder.end();
      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
      if (device.queue && typeof device.queue.onSubmittedWorkDone === 'function') {
        await device.queue.onSubmittedWorkDone();
      }
      this._addLog('pass', 'renderPass 提交完成（含深度附件 clear + draw + store）');

      this.setState({
        depthInfo:
          `device.createTexture({ size:[${W},${H},1], format:'${depthFormat}', usage: RENDER_ATTACHMENT }) → GPUTexture\n` +
          `  GPUTextureUsage.RENDER_ATTACHMENT=${TU.RENDER_ATTACHMENT}（深度纹理仅需此 usage）\n` +
          `  深度格式取值：'depth24plus' | 'depth24plus-stencil8' | 'depth32float' | 'depth16unorm'\n\n` +
          `renderPipeline descriptor 的 depthStencil 字段：\n` +
          `  depthStencil: { format: '${depthFormat}', depthWriteEnabled: true, depthCompare: 'less' }\n` +
          `  depthWriteEnabled：true 写入深度缓冲，false 只测试不写入（透明物体）\n` +
          `  depthCompare：深度比较函数（见下表）\n\n` +
          `encoder.beginRenderPass({ colorAttachments, depthStencilAttachment })：\n` +
          `  colorAttachments[0]: { view, clearValue:{r,g,b,a}, loadOp:'clear', storeOp:'store' }\n` +
          `    loadOp：'clear'（清屏）| 'load'（保留原内容）；storeOp：'store'（保存）| 'discard'\n` +
          `  depthStencilAttachment: {\n` +
          `    view: depthView,\n` +
          `    depthClearValue: 1.0,         // 1.0 = 最远（深度范围 [0,1]，0 近 1 远）\n` +
          `    depthLoadOp: 'clear', depthStoreOp: 'store',\n` +
          `    stencilClearValue: 0,         // 模板清零\n` +
          `    stencilLoadOp: 'clear', stencilStoreOp: 'store',\n` +
          `  }\n\n` +
          `depthCompare（GPUCompareFunction）取值：\n` +
          DEPTH_COMPARE_FUNCS.map((f, i) => `  ${i}. ${f}`).join('\n') + '\n\n' +
          `已提交 renderPass：clear 颜色+深度 → draw(3,1,0,0) → end → submit\n` +
          `  说明：mock 中 draw 为空操作，真实浏览器会执行深度测试（depthCompare:'less' 近物覆盖远物）。`,
      });
      this._addLog('depth', `深度渲染通道完成：format=${depthFormat}，depthCompare='less'`);
    } catch (err) {
      this._addLog('warn', `深度渲染通道失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. 深度/模板附件与渲染通道（Depth/Stencil & Render Pass）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'depthStencil ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'depth24plus | beginRenderPass'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createTexture({ format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT }) 创建深度纹理。renderPipeline descriptor 的 depthStencil: { format, depthWriteEnabled, depthCompare } 配置深度测试；depthCompare 取 never/less/equal/less-equal/greater 等。encoder.beginRenderPass({ colorAttachments: [{ view, loadOp:"clear", storeOp:"store", clearValue:{r,g,b,a} }], depthStencilAttachment: { view, depthClearValue:1.0, depthLoadOp:"clear", depthStoreOp:"store" } }) 开始渲染通道，深度范围 [0,1]（0 近 1 远）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建深度纹理与渲染通道', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createDepthRenderPass() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '深度纹理 / 渲染通道 / 比较函数：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.depthInfo || '（点击「创建深度纹理与渲染通道」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`const depthTex = device.createTexture({ size:[W,H,1], format:'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
const pipeline = device.createRenderPipeline({
  depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  // ... vertex/fragment/primitive ...
});
const pass = encoder.beginRenderPass({
  colorAttachments: [{ view: colorView, clearValue:{r:0,g:0,b:0,a:1}, loadOp:'clear', storeOp:'store' }],
  depthStencilAttachment: { view: depthTex.createView(), depthClearValue:1.0, depthLoadOp:'clear', depthStoreOp:'store' },
});
pass.setPipeline(pipeline); pass.draw(3,1,0,0); pass.end(); device.queue.submit([encoder.finish()]);`)),
        h(Alert, {
          type: 'info',
          message: 'depthWriteEnabled:false 用于透明物体（只测试不写入，避免遮挡）',
          description: '不透明物体先绘制（depthWriteEnabled:true，depthCompare:"less" 近物覆盖远物），透明物体后绘制（depthWriteEnabled:false 保留深度但不写入，按从远到近顺序）。stencil 附件用于模板测试（轮廓绘制、阴影体）。depth24plus 是最常用的深度格式（24 位深度，driver 选择具体精度）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：多重采样与 RenderBundle ===================

  // multisample:{ count:4 } + MSAA resolveTarget + createRenderBundleEncoder + executeBundles
  async _createMSAARenderBundle() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      const TU = _textureUsage();
      const W = 64, H = 64;
      const colorFormat = this._canvasFormat();
      const depthFormat = 'depth24plus';
      const sampleCount = 4; // 4x MSAA

      // MSAA 颜色纹理（多采样）+ resolve 目标纹理（单采样）
      this._addLog('msaa', `createTexture(MSAA count=${sampleCount}, RENDER_ATTACHMENT) + resolveTarget…`);
      const msaaTexture = device.createTexture({
        label: 'msaa-color',
        size: [W, H, 1],
        format: colorFormat,
        usage: TU.RENDER_ATTACHMENT,
        sampleCount,
      });
      this._msaaTexture = msaaTexture;
      const resolveTexture = device.createTexture({
        label: 'resolve-color',
        size: [W, H, 1],
        format: colorFormat,
        usage: TU.RENDER_ATTACHMENT | TU.COPY_SRC,
      });
      this._colorTexture = resolveTexture;
      const msaaView = msaaTexture.createView();
      const resolveView = resolveTexture.createView();

      const module = this._shaderModule || device.createShaderModule({ label: 'msaa-shader', code: TRIANGLE_WGSL });
      this._addLog('pipeline', `createRenderPipeline({ multisample:{ count: ${sampleCount} } })…`);
      const pipeline = device.createRenderPipeline({
        label: 'msaa-pipeline',
        layout: 'auto',
        vertex: { module, entryPoint: 'vs_main', buffers: [] },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format: colorFormat }] },
        primitive: { topology: 'triangle-list' },
        multisample: { count: sampleCount },
      });
      this._pipeline = pipeline;

      // RenderBundle：录制一次绘制命令，可重复 executeBundles
      this._addLog('bundle', `createRenderBundleEncoder({ colorFormats, depthStencilFormat }) → draw → finish()…`);
      const bundleEncoder = device.createRenderBundleEncoder({
        label: 'demo-bundle',
        colorFormats: [colorFormat],
        depthStencilFormat: depthFormat,
        sampleCount,
      });
      bundleEncoder.setPipeline(pipeline);
      if (this._vertexBuffer) bundleEncoder.setVertexBuffer(0, this._vertexBuffer);
      bundleEncoder.draw(3, 1, 0, 0);
      const renderBundle = bundleEncoder.finish();
      this._renderBundle = renderBundle;

      // 执行：beginRenderPass 时 colorAttachments 的 view 指向 MSAA 纹理，resolveTarget 指向单采样纹理
      this._addLog('pass', "beginRenderPass(MSAA view + resolveTarget) → executeBundles([bundle])…");
      const encoder = device.createCommandEncoder({ label: 'msaa-encoder' });
      const passEncoder = encoder.beginRenderPass({
        label: 'msaa-pass',
        colorAttachments: [{
          view: msaaView,
          resolveTarget: resolveView,
          clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      passEncoder.executeBundles([renderBundle]);
      passEncoder.end();
      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
      if (device.queue && typeof device.queue.onSubmittedWorkDone === 'function') {
        await device.queue.onSubmittedWorkDone();
      }
      this._addLog('pass', 'MSAA renderPass + executeBundles 提交完成');

      this.setState({
        msaaInfo:
          `renderPipeline descriptor 的 multisample 字段：\n` +
          `  multisample: { count: ${sampleCount} }   // ${sampleCount}x MSAA（多重采样抗锯齿）\n` +
          `  count 取值：1（无 MSAA，默认）| 4（4x MSAA，最常用）\n\n` +
          `MSAA 颜色附件：\n` +
          `  createTexture({ sampleCount: ${sampleCount}, usage: RENDER_ATTACHMENT }) → MSAA texture\n` +
          `  colorAttachments[0].view 指向 MSAA texture 的 view（多采样）\n` +
          `  colorAttachments[0].resolveTarget 指向单采样 texture 的 view（resolve 后的非 MSAA 结果）\n` +
          `  storeOp:'store' 时存 MSAA 数据，'discard' + resolveTarget 时只存 resolve 结果（更省显存）\n\n` +
          `RenderBundle（录制一次重复执行）：\n` +
          `  device.createRenderBundleEncoder({ colorFormats:[fmt], depthStencilFormat, sampleCount }) → GPURenderBundleEncoder\n` +
          `  bundleEncoder.setPipeline / setVertexBuffer / draw / ...（与 passEncoder 接口一致，但录制而非执行）\n` +
          `  bundleEncoder.finish() → GPURenderBundle（不可变命令包）\n` +
          `  passEncoder.executeBundles([bundle1, bundle2, ...]) —— 在 renderPass 中重放\n\n` +
          `RenderBundle 用途：\n` +
          `  - 录制一次绘制命令，多个 pass 重复 executeBundles，省去重复编码开销\n` +
          `  - 适合静态场景（多 pass 渲染、阴影、后处理），提升多 pass 性能\n` +
          `  - bundle 在创建时即完成验证，executeBundles 不再校验（更快）\n\n` +
          `已提交：MSAA pass（count=${sampleCount}）+ executeBundles([bundle]) → resolveTarget\n` +
          `  说明：mock 中 draw/resolve 为空操作，真实浏览器会做 4x 多采样并在 resolveTarget 解析抗锯齿结果。`,
      });
      this._addLog('bundle', `MSAA + RenderBundle 完成：sampleCount=${sampleCount}，bundle 已 executeBundles`);
    } catch (err) {
      this._addLog('warn', `MSAA/RenderBundle 创建失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 多重采样与 RenderBundle（MSAA & RenderBundle）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'MSAA ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'multisample.count=4 | executeBundles'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'renderPipeline descriptor 的 multisample: { count: 4 } 启用 4x MSAA（多重采样抗锯齿）。颜色附件 view 必须是 MSAA texture（sampleCount:4）的 view，resolveTarget 指向非 MSAA texture view（resolve 后的抗锯齿结果）。device.createRenderBundleEncoder({ colorFormats, depthStencilFormat, sampleCount }) 创建 bundle 编码器，bundleEncoder.setPipeline/draw 录制命令，finish() 返回不可变 GPURenderBundle，passEncoder.executeBundles([bundle]) 在 renderPass 中重放。RenderBundle 用于录制一次绘制命令重复执行，提升多 pass 性能。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 MSAA + RenderBundle', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createMSAARenderBundle() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'MSAA / RenderBundle / executeBundles：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.msaaInfo || '（点击「创建 MSAA + RenderBundle」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`const msaaTex = device.createTexture({ size:[W,H,1], format, usage: RENDER_ATTACHMENT, sampleCount: 4 });
const pipeline = device.createRenderPipeline({ multisample: { count: 4 }, /* ... */ });
const be = device.createRenderBundleEncoder({ colorFormats: [format], sampleCount: 4 });
be.setPipeline(pipeline); be.draw(3,1,0,0);
const bundle = be.finish();                       // 不可变命令包
const pass = encoder.beginRenderPass({
  colorAttachments: [{ view: msaaTex.createView(), resolveTarget: resolveTex.createView(),
                       clearValue:{r:0,g:0,b:0,a:1}, loadOp:'clear', storeOp:'store' }],
});
pass.executeBundles([bundle]); pass.end(); device.queue.submit([encoder.finish()]);`)),
        h(Alert, {
          type: 'info',
          message: 'RenderBundle 在创建时即完成验证，executeBundles 不再校验，故更快',
          description: 'RenderBundle 适合静态场景的重复绘制（如多 pass 阴影、后处理、UI 层）。MSAA 的 resolveTarget 自动把多采样结果解析为单采样纹理，storeOp 配合 resolveTarget 可省显存。count=4 是质量与性能的平衡点；count=1 即关闭 MSAA。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 7：上下文配置与设备丢失 ===================

  // canvas.getContext('webgpu') + configure + getPreferredCanvasFormat + alphaMode + device.lost + WebGL 对比
  async _configureContextAndLost() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      // 创建离屏 canvas 演示 context 配置
      const canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
      let ctx = null;
      let format = this._canvasFormat();
      let contextLine;
      if (canvas && typeof canvas.getContext === 'function') {
        ctx = canvas.getContext('webgpu');
        if (ctx && typeof ctx.configure === 'function') {
          canvas.width = 64; canvas.height = 64;
          ctx.configure({ device, format, alphaMode: 'opaque' });
          this._canvas = canvas; this._context = ctx;
          contextLine = `canvas.getContext('webgpu') → GPUCanvasContext ✓\n  context.configure({ device, format: '${format}', alphaMode: 'opaque' }) 已配置`;
          this._addLog('context', `getContext('webgpu') + configure({ format:'${format}', alphaMode:'opaque' }) 成功`);
        } else {
          contextLine = `canvas.getContext('webgpu') → ${ctx === null ? 'null（jsdom 无 WebGPU context）' : '对象但无 configure 方法'}\n  仅展示 configure 用法`;
          this._addLog('warn', 'jsdom 中 canvas.getContext("webgpu") 不可用，已记录用法');
        }
      } else {
        contextLine = 'document/canvas 不可用（非浏览器环境），仅展示用法';
        this._addLog('warn', 'document 不可用，跳过真实 context.configure');
      }

      // device.lost 监听
      let lostLine;
      if (device.lost && typeof device.lost.then === 'function') {
        const handler = (info) => {
          this._addLog('warn', `device.lost 触发：reason=${info && info.reason}, message=${info && info.message}`);
        };
        this._deviceLostHandler = handler;
        device.lost.then(handler);
        lostLine = `device.lost（Promise）已监听：resolve 后 { reason: 'destroyed'|'unknown', message }`;
        this._addLog('lost', 'device.lost Promise 已注册 then 监听');
      } else {
        lostLine = 'device.lost 不可用（当前 mock 无此属性）';
      }

      // 主动触发一次 device.lost（destroy 后 lost resolve）—— 仅演示，不真实 destroy（避免影响后续卡片）
      let destroyDemoLine;
      if (typeof device.destroy === 'function') {
        destroyDemoLine = "device.destroy() → device.lost resolve({ reason:'destroyed', message })，需重建 device + 所有资源";
      } else {
        destroyDemoLine = 'device.destroy 不可用';
      }

      this.setState({
        contextInfo:
          `canvas.getContext('webgpu') → GPUCanvasContext：\n` +
          contextLine + '\n\n' +
          `context.configure({ device, format, alphaMode }) 配置项：\n` +
          `  device：绑定的 GPUDevice（提交的命令将渲染到该 canvas）\n` +
          `  format：纹理格式，navigator.gpu.getPreferredCanvasFormat() → '${format}'\n` +
          `    返回 'bgra8unorm'（多数平台默认）或 'rgba8unorm'\n` +
          `  alphaMode：'opaque'（默认，不透明，alpha 被忽略）| 'premultiplied'（预乘 alpha）\n` +
          `    对比 WebGL 的 preserveDrawingBuffer（WebGL 才有，控制缓冲是否保留）\n\n` +
          `WebGL 上下文丢失（webglcontextlost / webglcontextrestored）：\n` +
          `  canvas.addEventListener('webglcontextlost', e => e.preventDefault());  // 阻止默认行为\n` +
          `  canvas.addEventListener('webglcontextrestored', () => { /* 重建资源 */ });\n` +
          `  事件驱动，preventDefault 后可恢复\n\n` +
          `WebGPU 设备丢失（device.lost Promise）：\n` +
          `  ${lostLine}\n` +
          `  reason 取值：'destroyed'（主动 device.destroy()）| 'unknown'（GPU 崩溃/驱动重置等）\n` +
          `  ${destroyDemoLine}\n\n` +
          `资源重建策略（device.lost 后）：\n` +
          `  1) 释放旧引用（旧 device 的 buffer/texture/pipeline 全部失效，不可再 destroy）\n` +
          `  2) 重新 navigator.gpu.requestAdapter() —— 旧 adapter 可能也已失效\n` +
          `  3) adapter.requestDevice() 获取新 device\n` +
          `  4) 重建所有 GPUBuffer / GPUTexture / GPUSampler\n` +
          `  5) 重建 createBindGroupLayout / createPipelineLayout / createBindGroup\n` +
          `  6) 重建 createShaderModule / createRenderPipeline\n` +
          `  7) context.configure({ device: 新 device, ... }) 重新配置 canvas context\n` +
          `  8) 重新提交绘制命令\n\n` +
          `对比：WebGL 上下文丢失是 canvas 级别事件（可 preventDefault 恢复）；WebGPU 设备丢失是 device 级别 Promise（不可恢复，必须重建 device 与全部资源）。`,
      });
    } catch (err) {
      this._addLog('warn', `Context/DeviceLost 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard7() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '7. 上下文配置与设备丢失（Context & Device Lost）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'configure ✓' : '不可用'),
        h(Tag, { color: caps.getPreferredCanvasFormat ? 'success' : 'error' }, caps.getPreferredCanvasFormat ? 'canvasFormat ✓' : 'canvasFormat ✗'),
        h(Tag, { color: 'primary' }, 'device.lost'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'canvas.getContext("webgpu") 返回 GPUCanvasContext；context.configure({ device, format, alphaMode }) 绑定设备。format 由 navigator.gpu.getPreferredCanvasFormat() 返回（"bgra8unorm" 或 "rgba8unorm"）；alphaMode ∈ "opaque"(默认不透明)|"premultiplied"(预乘 alpha)。WebGL 上下文丢失用 webglcontextlost/webglcontextrestored 事件（preventDefault 恢复）；WebGPU 设备丢失用 device.lost Promise，resolve 后 { reason: "destroyed"|"unknown", message }，需重建 device + 所有资源（buffer/texture/pipeline/bindGroup）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('配置 Context + 监听 device.lost', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._configureContextAndLost() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Context 配置 / 设备丢失 / 重建策略：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.contextInfo || '（点击「配置 Context + 监听 device.lost」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const ctx = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();   // 'bgra8unorm' | 'rgba8unorm'
ctx.configure({ device, format, alphaMode: 'opaque' });

device.lost.then((info) => {                                  // 设备丢失 Promise
  console.error('Device lost:', info.reason, info.message);   // 'destroyed' | 'unknown'
  // 重建：requestAdapter → requestDevice → 重建所有资源 → ctx.configure({device:new})
});

// WebGL 对比：
canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
canvas.addEventListener('webglcontextrestored', () => { /* 重建资源 */ });`)),
        h(Alert, {
          type: 'warning',
          message: 'WebGPU 设备丢失不可恢复，必须重建 device 与全部 GPU 资源',
          description: '不同于 WebGL 的 webglcontextlost（可 preventDefault 后在同一 context 上恢复），WebGPU device.lost 表示 device 彻底失效，所有关联资源（buffer/texture/pipeline/bindGroup）失效。生产代码应在 device.lost 的 then 回调中完整执行重建流程，并重新 configure canvas context。alphaMode:"opaque" 性能最佳（合成器无需处理透明度）。',
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
      h('h2', { class: 'section-title' }, 'WebGPU 渲染管线实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'WebGPU 是 WebGL 的继任者，提供显式 GPU 资源管理与现代渲染管线（render pipeline）能力。本页演示顶点缓冲/索引缓冲/Uniform 缓冲/采样纹理与采样器/深度模板附件/MSAA 与 RenderBundle/上下文配置与设备丢失，覆盖 createRenderPipeline、beginRenderPass、draw/drawIndexed、setVertexBuffer/setIndexBuffer/setBindGroup 等 MDN API。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderCard7(),
      this._renderLogPanel(),
    );
  }
}
