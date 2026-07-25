// =====================================================================
// WebGPUComputePage.js —— WebGPU 计算管线实验室
// 演示 MDN：1) GPUAdapter（requestAdapter/info/features/limits/isFallbackAdapter）
//   2) GPUDevice 资源创建（createBuffer/createBindGroupLayout/createPipelineLayout/
//      createShaderModule/createComputePipeline/createComputePipelineAsync/pushErrorScope/popErrorScope/uncapturederror）
//   3) WGSL 计算着色器（@compute/@workgroup_size/@group/@binding/var<storage, read|read_write>/内置变量）
//   4) 计算管线执行（createCommandEncoder/beginComputePass/setPipeline/setBindGroup/dispatchWorkgroups/
//      dispatchWorkgroupsIndirect/end/copyBufferToBuffer/finish/queue.submit/onSubmittedWorkDone）
//   5) Buffer 映射与数据读写（mapAsync/getMappedRange/unmap/mapState/queue.writeBuffer/buffer.destroy）
//   6) Storage Buffer + Bind Group（createBindGroup 绑定多个 buffer）
// 说明：WebGPU 是 WebGL 的继任者，提供显式 GPU 资源管理与通用计算（GPGPU）能力。
//   所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
//   jsdom/Node 中 navigator.gpu 已 polyfill，但 GPUBufferUsage/GPUShaderStage/GPUMapMode 等常量对象可能未定义，本页提供本地回退常量。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// —— 本地回退常量：当全局 GPUBufferUsage / GPUShaderStage / GPUMapMode 未定义时使用（位掩码值与 WebGPU 规范一致）——
const FALLBACK_GPUBufferUsage = {
  MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8,
  INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128,
  INDIRECT: 256, QUERY_RESOLVE: 512,
};
const FALLBACK_GPUShaderStage = { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
const FALLBACK_GPUMapMode = { READ: 1, WRITE: 2 };

// 取活跃的常量对象（优先全局，回退本地）
const _bufferUsage = () => (typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage : FALLBACK_GPUBufferUsage);
const _shaderStage = () => (typeof GPUShaderStage !== 'undefined' ? GPUShaderStage : FALLBACK_GPUShaderStage);
const _mapMode = () => (typeof GPUMapMode !== 'undefined' ? GPUMapMode : FALLBACK_GPUMapMode);

// —— WGSL 计算着色器：元素乘以 2（演示 storage buffer 读写）——
// @compute 标记计算入口；@workgroup_size(64) 每个工作组 64 个 invocation；
// @group/@binding 绑定资源；var<storage, read> 只读，var<storage, read_write> 可读写；global_invocation_id 是内置三维线程索引。
const MULTIPLY_WGSL = `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&input)) { return; }
  output[i] = input[i] * 2.0;
}
`;

// —— WGSL 计算着色器：元素平方（演示不同 entryPoint 的能力）——
const SQUARE_WGSL = `
@group(0) @binding(0) var<storage, read> data_in: array<f32>;
@group(0) @binding(1) var<storage, read_write> data_out: array<f32>;

@compute @workgroup_size(64)
fn square(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&data_in)) { return; }
  data_out[i] = data_in[i] * data_in[i];
}
`;

// 常见可选 feature 列表（用于对照 adapter.features.has() 检测）
const COMMON_FEATURES = [
  'depth-clip-control', 'texture-compression-bc', 'texture-compression-etc2',
  'texture-compression-astc', 'timestamp-query', 'indirect-first-instance',
  'shader-f16', 'bgra8unorm-storage', 'rg11b10ufloat-renderable', 'subgroups',
];

// 计算相关 limit 字段（用于从 adapter.limits 读取并展示）
const COMPUTE_LIMITS = [
  'maxStorageBufferBindingSize', 'maxBufferSize',
  'maxComputeWorkgroupsPerDimension',
  'maxComputeWorkgroupSizeX', 'maxComputeWorkgroupSizeY', 'maxComputeWorkgroupSizeZ',
  'maxComputeInvocationsPerWorkgroup',
  'maxStorageBuffersPerShaderStage', 'minStorageBufferOffsetAlignment',
];

export class WebGPUComputePage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      adapterInfo: '',   // Card 1：GPUAdapter 信息与能力检测
      bufferInfo: '',    // Card 2：GPUBuffer 创建与映射
      bindGroupInfo: '', // Card 3：BindGroupLayout + BindGroup
      shaderInfo: '',    // Card 4：WGSL 计算着色器
      computeInfo: '',   // Card 5：ComputePipeline + dispatchWorkgroups
      errorInfo: '',     // Card 6：错误处理与资源释放
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._adapter = null; this._device = null; this._buffer = null;
    this._bindGroupLayout = null; this._bindGroup = null; this._shaderModule = null;
    this._pipeline = null; this._inputBuffer = null; this._outputBuffer = null;
    this._stagingBuffer = null; this._uncapturedHandler = null;

    // 一次性能力检测：navigator.gpu 全家桶
    const caps = this._caps();
    const parts = [
      `navigator.gpu ${caps.gpu ? '✓' : '✗'}`,
      `requestAdapter ${caps.requestAdapter ? '✓' : '✗'}`,
      `GPUBufferUsage ${caps.bufferUsage ? '✓' : '✗（用本地回退）'}`,
      `GPUShaderStage ${caps.shaderStage ? '✓' : '✗（用本地回退）'}`,
      `GPUMapMode ${caps.mapMode ? '✓' : '✗（用本地回退）'}`,
    ];

    const summary = caps.gpu
      ? `WebGPU 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）navigator.gpu 已 polyfill，可演示 requestAdapter / createBuffer / createShaderModule / createComputePipeline / dispatchWorkgroups 等完整流程；GPUBufferUsage 等常量对象若未定义则用本地回退值（与规范位掩码一致）。`
      : '当前环境不支持 WebGPU（navigator.gpu 未定义）；所有按钮点击将仅记日志说明，不会抛异常。在支持 WebGPU 的浏览器（Chrome 113+/Edge 113+）中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(caps.gpu ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.bufferUsage) this._addLog('warn', 'GPUBufferUsage 未定义，使用本地回退常量（位掩码值与规范一致）');
    if (!caps.shaderStage) this._addLog('warn', 'GPUShaderStage 未定义，使用本地回退常量');
    if (!caps.mapMode) this._addLog('warn', 'GPUMapMode 未定义，使用本地回退常量');
  }

  componentWillUnmount() {
    // 释放 GPU 资源：buffer.destroy() / device.destroy()
    try {
      if (this._buffer && typeof this._buffer.destroy === 'function') this._buffer.destroy();
      if (this._inputBuffer && typeof this._inputBuffer.destroy === 'function') this._inputBuffer.destroy();
      if (this._outputBuffer && typeof this._outputBuffer.destroy === 'function') this._outputBuffer.destroy();
      if (this._stagingBuffer && typeof this._stagingBuffer.destroy === 'function') this._stagingBuffer.destroy();
      if (this._device && typeof this._device.destroy === 'function') this._device.destroy();
    } catch { /* noop */ }
    // 解绑 uncapturederror 监听
    if (this._device && this._uncapturedHandler && typeof this._device.removeEventListener === 'function') {
      try { this._device.removeEventListener('uncapturederror', this._uncapturedHandler); } catch { /* noop */ }
    }
    this._adapter = this._device = this._buffer = this._bindGroupLayout = this._bindGroup = null;
    this._shaderModule = this._pipeline = this._inputBuffer = this._outputBuffer = this._stagingBuffer = null;
    this._uncapturedHandler = null;
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
    this._device = await this._adapter.requestDevice({ label: 'webgpu-compute-lab' });
    return this._device;
  }

  // =================== Card 1：GPUAdapter 信息与能力检测 ===================

  // navigator.gpu.requestAdapter({ powerPreference, forceSoftware }) → Promise<GPUAdapter|null>
  async _requestAdapter() {
    if (!this._caps().gpu || !this._caps().requestAdapter) {
      this._addLog('warn', 'navigator.gpu.requestAdapter 不可用');
      return;
    }
    try {
      this._addLog('adapter', 'requestAdapter({ powerPreference: "high-performance", forceSoftware: false })…');
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
        forceSoftware: false,
      });
      if (!adapter) {
        this.setState({ adapterInfo: 'requestAdapter() 返回 null —— 当前环境无可用 GPU 适配器。' });
        this._addLog('warn', 'requestAdapter 返回 null（无可用适配器）');
        return;
      }
      this._adapter = adapter;
      const info = adapter.info || {};
      const vendor = info.vendor ?? '(未提供)';
      const architecture = info.architecture ?? '(未提供)';
      const description = info.description ?? '(未提供)';
      const subgroupMin = info.subgroupMinSize ?? '(未提供)';
      const subgroupMax = info.subgroupMaxSize ?? '(未提供)';
      const featSet = adapter.features;
      const supported = [];
      if (featSet && typeof featSet.has === 'function') {
        for (const f of COMMON_FEATURES) supported.push(`${f}: ${featSet.has(f) ? '支持' : '不支持'}`);
      }
      const limits = adapter.limits || {};
      const limitLines = COMPUTE_LIMITS.map((k) => `  ${k} = ${limits[k] ?? '(未提供)'}`);
      const isFallback = adapter.isFallbackAdapter;
      const supportedCount = supported.filter((s) => s.endsWith('支持')).length;
      this.setState({
        adapterInfo:
          `navigator.gpu.requestAdapter({ powerPreference: 'high-performance', forceSoftware: false })\n` +
          `  → GPUAdapter ✓\n\n` +
          `adapter.info（GPUAdapterInfo）：\n` +
          `  vendor = ${vendor}，architecture = ${architecture}\n` +
          `  description = ${description}\n  subgroupMinSize = ${subgroupMin}，subgroupMaxSize = ${subgroupMax}\n\n` +
          `adapter.isFallbackAdapter = ${isFallback}（true 表示软件回退适配器）\n\n` +
          `adapter.features（GPUSupportedFeatures，Set-like）常见 feature 检测：\n` +
          supported.map((s) => `  • ${s}`).join('\n') + '\n\n' +
          `adapter.limits（GPUSupportedLimits）计算相关：\n` + limitLines.join('\n'),
      });
      this._addLog('adapter', `已获取 adapter：vendor=${vendor}，isFallback=${isFallback}，features 支持 ${supportedCount}/${COMMON_FEATURES.length}`);
    } catch (err) {
      this._addLog('warn', `requestAdapter 失败：${err.name} - ${err.message}`);
    }
  }

  // adapter.requestDevice(descriptor) → Promise<GPUDevice>
  async _requestDevice() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      if (!this._adapter) {
        this._addLog('adapter', '尚未获取 adapter，先 requestAdapter({ powerPreference: "low-power" })…');
        this._adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
        if (!this._adapter) {
          this._addLog('warn', 'requestAdapter 返回 null，无法 requestDevice');
          return;
        }
      }
      this._addLog('device', 'adapter.requestDevice({ label, requiredFeatures, requiredLimits })…');
      const device = await this._adapter.requestDevice({
        label: 'webgpu-compute-lab',
        requiredFeatures: [],
        requiredLimits: {},
      });
      this._device = device;
      this.setState({
        adapterInfo: (this.state.adapterInfo || '') +
          `\n\nadapter.requestDevice({ label: 'webgpu-compute-lab', requiredFeatures: [], requiredLimits: {} })\n` +
          `  → GPUDevice ✓\n  device.label = ${device.label}\n` +
          `说明：requiredFeatures/requiredLimits 会向设备请求额外能力，超出 adapter 支持会抛错；\n` +
          `      device 拥有 createBuffer/createShaderModule/createComputePipeline 等资源创建方法。`,
      });
      this._addLog('device', `已获取 device：label=${device.label}，后续卡片可复用`);
    } catch (err) {
      this._addLog('warn', `requestDevice 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. GPUAdapter 信息与能力检测',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'navigator.gpu ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'requestAdapter / info'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.gpu.requestAdapter(options) → Promise<GPUAdapter|null>，options.powerPreference ∈ "low-power" | "high-performance"，options.forceSoftware 强制软件渲染。adapter.info（GPUAdapterInfo）含 vendor/architecture/description/subgroupMinSize/subgroupMaxSize；adapter.features（GPUSupportedFeatures，Set-like）用 .has() 检测可选能力（如 texture-compression-bc、shader-f16、timestamp-query、subgroups）；adapter.limits（GPUSupportedLimits）含 maxComputeWorkgroupsPerDimension、maxStorageBufferBindingSize 等；adapter.isFallbackAdapter 标识是否软件回退；adapter.requestDevice(descriptor) → Promise<GPUDevice>。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('requestAdapter', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._requestAdapter() }),
          this._btn('requestDevice', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._requestDevice() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'adapter.info / features / limits：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.adapterInfo || '（点击 requestAdapter / requestDevice）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {},
`const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
adapter.features.has('shader-f16');   // GPUSupportedFeatures（Set-like）
adapter.limits.maxComputeWorkgroupsPerDimension;
const device = await adapter.requestDevice({ requiredFeatures: ['timestamp-query'] });`)),
        h(Alert, {
          type: 'info',
          message: 'requestAdapter 返回 null 表示无可用适配器',
          description: 'powerPreference 只是建议，浏览器可能忽略；forceSoftware:true 强制软件渲染（用于测试）。adapter 可创建多个 device；device 是资源隔离单元，destroy 后所有关联资源失效。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：GPUBuffer 创建与映射 ===================

  // device.createBuffer({ size, usage }) + queue.writeBuffer + mapAsync + getMappedRange + unmap
  async _createAndMapBuffer() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      const BU = _bufferUsage();
      const MM = _mapMode();
      const elementCount = 16;
      const byteLength = elementCount * Float32Array.BYTES_PER_ELEMENT; // 64
      this._addLog('buffer', `createBuffer(STORAGE|COPY_SRC|MAP_READ, size=${byteLength})…`);
      const buffer = device.createBuffer({ label: 'demo-buffer', size: byteLength, usage: BU.STORAGE | BU.COPY_SRC | BU.MAP_READ });
      this._buffer = buffer;
      // 写入数据：queue.writeBuffer(buffer, offset, data)
      const srcData = new Float32Array(elementCount);
      for (let i = 0; i < elementCount; i++) srcData[i] = i + 1;
      device.queue.writeBuffer(buffer, 0, srcData);
      this._addLog('buffer', `queue.writeBuffer 写入 ${elementCount} 个 f32：[${srcData.slice(0, 4).join(', ')}…]`);
      const stateBefore = buffer.mapState;
      const mapPromise = buffer.mapAsync(MM.READ);   // mapAsync(READ) —— 异步映射
      const statePending = buffer.mapState;
      await mapPromise;
      const stateMapped = buffer.mapState;
      const range = buffer.getMappedRange();          // getMappedRange 读取
      const view = new Float32Array(range);
      const readOut = Array.from(view);
      buffer.unmap();                                  // unmap
      const stateAfter = buffer.mapState;
      const usageMask = BU.STORAGE | BU.COPY_SRC | BU.MAP_READ;
      this.setState({
        bufferInfo:
          `device.createBuffer({ size: ${byteLength}, usage: STORAGE|COPY_SRC|MAP_READ }) → GPUBuffer\n` +
          `  GPUBufferUsage 位掩码：STORAGE=${BU.STORAGE}, COPY_SRC=${BU.COPY_SRC}, MAP_READ=${BU.MAP_READ}，usage=${usageMask}（按位或）\n\n` +
          `device.queue.writeBuffer(buffer, 0, Float32Array[${elementCount}]) 写入：[${srcData.slice(0, 8).join(', ')}${elementCount > 8 ? ', …' : ''}]\n\n` +
          `buffer.mapAsync(GPUMapMode.READ) 状态变迁：\n` +
          `  mapState: '${stateBefore}' → '${statePending}'（pending）→ '${stateMapped}'（mapped）\n\n` +
          `buffer.getMappedRange() → ArrayBuffer（byteLength=${range.byteLength}）\n` +
          `  读出（Float32Array）: [${readOut.slice(0, 8).join(', ')}${elementCount > 8 ? ', …' : ''}]\n\n` +
          `buffer.unmap() → mapState = '${stateAfter}'\n` +
          `说明：mapAsync 异步映射；getMappedRange 返回的 ArrayBuffer 在 unmap 后失效。`,
      });
      this._addLog('map', `mapAsync 完成：mapState ${stateBefore}→${statePending}→${stateMapped}→${stateAfter}，读出 [${readOut.slice(0, 4).join(',')}]`);
    } catch (err) {
      this._addLog('warn', `Buffer 创建/映射失败：${err.name} - ${err.message}`);
    }
  }

  // buffer.destroy() —— 释放 GPU 内存
  _destroyBuffer() {
    if (!this._buffer) {
      this._addLog('warn', '请先点击「创建并映射 Buffer」');
      return;
    }
    try {
      this._addLog('buffer', 'buffer.destroy() 释放 GPU 内存');
      this._buffer.destroy();
      this.setState({
        bufferInfo: (this.state.bufferInfo || '') +
          `\n\nbuffer.destroy() 已调用 —— 释放 GPU 内存，buffer 不再可用。\n` +
          `mapState = ${this._buffer.mapState}`,
      });
      this._buffer = null;
    } catch (err) {
      this._addLog('warn', `destroy 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. GPUBuffer 创建与映射',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'createBuffer ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'STORAGE / MAP_READ'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createBuffer({ size, usage }) 创建 GPUBuffer，usage 是 GPUBufferUsage 位掩码按位或（STORAGE / UNIFORM / COPY_SRC / COPY_DST / MAP_READ / MAP_WRITE）。device.queue.writeBuffer(buffer, offset, data) 写入数据。buffer.mapAsync(GPUMapMode.READ|WRITE) → Promise 异步映射；buffer.mapState ∈ "unmapped"|"pending"|"mapped"；buffer.getMappedRange(offset?, size?) → ArrayBuffer 读写映射区；buffer.unmap() 解除映射（映射区失效）；buffer.destroy() 释放 GPU 内存。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建并映射 Buffer', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createAndMapBuffer() }),
          this._btn('destroy Buffer', { danger: true, size: 'sm', disabled: !caps.gpu, onClick: () => this._destroyBuffer() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Buffer 映射状态与数据：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.bufferInfo || '（点击「创建并映射 Buffer」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {},
`const buf = device.createBuffer({ size: 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
device.queue.writeBuffer(buf, 0, new Float32Array([1, 2, 3, 4]));
await buf.mapAsync(GPUMapMode.READ);              // mapState: unmapped→pending→mapped
const data = new Float32Array(buf.getMappedRange()); // 读取映射区
buf.unmap(); buf.destroy();                       // 映射区失效 + 释放 GPU 内存`)),
        h(Alert, {
          type: 'warning',
          message: '读取 storage buffer 结果应使用 staging buffer 中转',
          description: '真实 WebGPU 中 MAP_READ 仅可与 COPY_DST 组合（不能与 STORAGE/COPY_SRC 同用）。读 storage buffer 结果的惯用法：创建 STORAGE|COPY_SRC 的输出 buffer + COPY_DST|MAP_READ 的 staging buffer，计算后 copyBufferToBuffer 拷贝到 staging，再 mapAsync 读取。Card 5 演示了该完整流程。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：BindGroupLayout + BindGroup ===================

  // createBindGroupLayout + createPipelineLayout + createBindGroup
  async _createBindGroup() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      const BU = _bufferUsage();
      const SS = _shaderStage();
      this._addLog('bind', 'createBindGroupLayout({ entries: [read-only-storage, storage] })…');
      const bindGroupLayout = device.createBindGroupLayout({
        label: 'compute-bgl',
        entries: [
          { binding: 0, visibility: SS.COMPUTE, buffer: { type: 'read-only-storage', hasDynamicOffset: false } },
          { binding: 1, visibility: SS.COMPUTE, buffer: { type: 'storage', hasDynamicOffset: false } },
        ],
      });
      this._bindGroupLayout = bindGroupLayout;
      const elementCount = 64;
      const byteLength = elementCount * Float32Array.BYTES_PER_ELEMENT;
      const mkBuf = (label, usage) => device.createBuffer({ label, size: byteLength, usage });
      const inputBuf = mkBuf('bgl-input', BU.STORAGE | BU.COPY_DST);
      const outputBuf = mkBuf('bgl-output', BU.STORAGE | BU.COPY_SRC);
      this._addLog('bind', 'createBindGroup({ layout, entries: [input@0, output@1] })…');
      const bindGroup = device.createBindGroup({
        label: 'compute-bg',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: inputBuf, offset: 0, size: byteLength } },
          { binding: 1, resource: { buffer: outputBuf, offset: 0, size: byteLength } },
        ],
      });
      this._bindGroup = bindGroup;
      const pipelineLayout = device.createPipelineLayout({
        label: 'compute-pll',
        bindGroupLayouts: [bindGroupLayout],
      });
      this.setState({
        bindGroupInfo:
          `device.createBindGroupLayout({ entries: [...] }) → GPUBindGroupLayout\n` +
          `  GPUShaderStage.COMPUTE = ${SS.COMPUTE}（visibility 按位或，可同时给 VERTEX|FRAGMENT|COMPUTE）\n` +
          `  entry[0]: binding=0, visibility=COMPUTE, buffer.type='read-only-storage'\n` +
          `  entry[1]: binding=1, visibility=COMPUTE, buffer.type='storage'（即 read_write）\n` +
          `  buffer.type 取值：'uniform' | 'storage'（read_write）| 'read-only-storage'\n\n` +
          `device.createBuffer(STORAGE|COPY_DST, ${byteLength}B) → inputBuf @binding 0\n` +
          `device.createBuffer(STORAGE|COPY_SRC, ${byteLength}B) → outputBuf @binding 1\n\n` +
          `device.createBindGroup({ layout, entries: [...] }) → GPUBindGroup\n` +
          `  entry[0]: binding=0, resource.buffer=inputBuf, offset=0, size=${byteLength}\n` +
          `  entry[1]: binding=1, resource.buffer=outputBuf, offset=0, size=${byteLength}\n\n` +
          `device.createPipelineLayout({ bindGroupLayouts: [bgl] }) → GPUPipelineLayout\n` +
          `  说明：pipelineLayout 把 bindGroupLayouts 按 group index 组织，对应 WGSL @group(0)/@group(1)。\n\n` +
          `绑定关系（对应 WGSL）：@group(0)@binding(0) var<storage, read> input ← inputBuf\n` +
          `                  @group(0)@binding(1) var<storage, read_write> output ← outputBuf`,
      });
      this._addLog('bind', `已创建 BindGroupLayout + BindGroup + PipelineLayout（2 个 buffer 绑定到 @group(0)）`);
      // 释放这两个临时 buffer（仅演示绑定，不在后续流程使用）
      try { inputBuf.destroy(); outputBuf.destroy(); } catch { /* noop */ }
    } catch (err) {
      this._addLog('warn', `BindGroup 创建失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. BindGroupLayout + BindGroup',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'BindGroup ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'storage / read-only-storage'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createBindGroupLayout({ entries }) 定义资源布局：每项 { binding, visibility, buffer: { type, hasDynamicOffset } }，visibility 用 GPUShaderStage.VERTEX/FRAGMENT/COMPUTE 按位或，buffer.type ∈ "uniform"|"storage"(read_write)|"read-only-storage"。device.createPipelineLayout({ bindGroupLayouts }) 按 group index 组织布局。device.createBindGroup({ layout, entries }) 把具体 buffer 绑定到 layout：每项 { binding, resource: { buffer, offset, size } }，对应 WGSL 的 @group(N) @binding(M)。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 BindGroup', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createBindGroup() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'BindGroupLayout / BindGroup / PipelineLayout：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.bindGroupInfo || '（点击「创建 BindGroup」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } },
          h('code', {},
`const bgl = device.createBindGroupLayout({ entries: [
  { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
  { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
] });
const pll = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
const bg = device.createBindGroup({ layout: bgl, entries: [
  { binding: 0, resource: { buffer: inputBuf, offset: 0, size: 256 } },
  { binding: 1, resource: { buffer: outputBuf, offset: 0, size: 256 } },
] });
// 对应 WGSL: @group(0) @binding(0) var<storage, read> input;`)),
        h(Alert, {
          type: 'info',
          message: 'BindGroupLayout 是「形状」，BindGroup 是「实例」',
          description: 'Layout 描述绑定槽位的类型与可见性（可被多个 pipeline 复用）；BindGroup 把具体 buffer/texture/sampler 绑定到这些槽位。dispatchWorkgroups 前 setBindGroup(groupIndex, bindGroup) 把 BindGroup 绑定到管线。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：WGSL 计算着色器 ===================

  // device.createShaderModule({ code }) + module.getCompilationInfo()
  async _compileShader() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      this._addLog('shader', 'createShaderModule({ code: MULTIPLY_WGSL })…');
      const module = device.createShaderModule({ label: 'multiply-shader', code: MULTIPLY_WGSL });
      this._shaderModule = module;
      let compilationInfo = '(不可用)';
      if (module && typeof module.getCompilationInfo === 'function') {
        try {
          const info = await module.getCompilationInfo();
          const msgs = info.messages || [];
          compilationInfo = msgs.length === 0
            ? '无消息（编译通过，0 条 message）'
            : msgs.map((m) => `  [${m.type}] line ${m.lineNum}:${m.linePos} ${m.message}`).join('\n');
        } catch (err) {
          compilationInfo = `getCompilationInfo 失败：${err.message}`;
        }
      }
      this.setState({
        shaderInfo:
          `device.createShaderModule({ code: WGSL 字符串 }) → GPUShaderModule\n` +
          `  module.label = ${module.label}\n\n` +
          `WGSL 代码（MULTIPLY_WGSL）：\n${MULTIPLY_WGSL.trim()}\n\n` +
          `module.getCompilationInfo() → GPUCompilationInfo：\n${compilationInfo}\n\n` +
          `WGSL 关键语法：@compute 标记入口；@workgroup_size(64) 每组 64 invocation；\n` +
          `  @group(0)@binding(0) 资源绑定 slot；var<storage, read> 只读 / var<storage, read_write> 可读写 / var<uniform>\n` +
          `  内置变量：global_invocation_id / local_invocation_id / workgroup_id / num_workgroups`,
      });
      const passed = compilationInfo === '无消息（编译通过，0 条 message）';
      this._addLog('shader', `createShaderModule 成功：label=${module.label}，compilationInfo=${passed ? '通过' : '见详情'}`);
    } catch (err) {
      this._addLog('warn', `createShaderModule 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. WGSL 计算着色器',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'WGSL ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '@compute / @workgroup_size'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createShaderModule({ code }) 接收 WGSL（WebGPU Shading Language）字符串返回 GPUShaderModule。WGSL 计算着色器用 @compute 标记入口，@workgroup_size(N) 定义工作组大小，@group(N)/@binding(M) 绑定资源。var<storage, read> 只读、var<storage, read_write> 可读写、var<uniform> uniform buffer。内置变量：global_invocation_id（全局线程索引）、local_invocation_id（组内索引）、workgroup_id（工作组索引）、num_workgroups（工作组总数）。module.getCompilationInfo() 返回编译消息（错误/警告）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('编译 WGSL', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._compileShader() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'WGSL 代码与编译信息：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.shaderInfo || '（点击「编译 WGSL」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '另一段 entryPoint（square）对照（input[i]²）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {}, SQUARE_WGSL.trim())),
        h(Alert, {
          type: 'info',
          message: '@workgroup_size 决定 GPU 并行粒度',
          description: '工作组（workgroup）内的 invocation 共享共享内存（shared memory）并可同步；dispatchWorkgroups(countX, Y, Z) 调度 countX×Y×Z 个工作组。全局线程数 = workgroup_count × workgroup_size。计算着色器通过 global_invocation_id 定位自己处理的数据。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：ComputePipeline + dispatchWorkgroups ===================

  // 完整计算管线：createBuffer×3 → writeBuffer → createBindGroupLayout/PipelineLayout/ShaderModule/createComputePipeline →
  // createBindGroup → createCommandEncoder → beginComputePass → setPipeline/setBindGroup/dispatchWorkgroups/end →
  // copyBufferToBuffer → finish/submit → onSubmittedWorkDone → staging.mapAsync → getMappedRange → 读取结果
  async _runComputePass() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      const BU = _bufferUsage();
      const SS = _shaderStage();
      const MM = _mapMode();
      const elementCount = 64;          // 1 个 workgroup 即可（@workgroup_size(64)）
      const byteLength = elementCount * Float32Array.BYTES_PER_ELEMENT;
      const mkBuf = (label, usage) => device.createBuffer({ label, size: byteLength, usage });
      const inputBuffer = mkBuf('compute-input', BU.STORAGE | BU.COPY_DST);
      const outputBuffer = mkBuf('compute-output', BU.STORAGE | BU.COPY_SRC);
      const stagingBuffer = mkBuf('compute-staging', BU.COPY_DST | BU.MAP_READ);
      this._inputBuffer = inputBuffer;
      this._outputBuffer = outputBuffer;
      this._stagingBuffer = stagingBuffer;
      const srcData = new Float32Array(elementCount);
      for (let i = 0; i < elementCount; i++) srcData[i] = (i + 1) * 1.0;
      device.queue.writeBuffer(inputBuffer, 0, srcData);
      this._addLog('pass', `writeBuffer 输入 ${elementCount} 个 f32：[${srcData.slice(0, 4).join(', ')}…]`);
      const bgl = device.createBindGroupLayout({
        label: 'compute-pass-bgl',
        entries: [
          { binding: 0, visibility: SS.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 1, visibility: SS.COMPUTE, buffer: { type: 'storage' } },
        ],
      });
      const pll = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
      const module = this._shaderModule || device.createShaderModule({ code: MULTIPLY_WGSL });
      this._addLog('pass', 'createComputePipeline({ layout, compute: { module, entryPoint: "main" } })…');
      const pipeline = device.createComputePipeline({
        label: 'multiply-pipeline',
        layout: pll,
        compute: { module, entryPoint: 'main', constants: {} },
      });
      this._pipeline = pipeline;
      const bindGroup = device.createBindGroup({
        layout: bgl,
        entries: [
          { binding: 0, resource: { buffer: inputBuffer, offset: 0, size: byteLength } },
          { binding: 1, resource: { buffer: outputBuffer, offset: 0, size: byteLength } },
        ],
      });
      const encoder = device.createCommandEncoder({ label: 'compute-encoder' });
      const passEncoder = encoder.beginComputePass({ label: 'multiply-pass' });
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      const workgroupCountX = Math.ceil(elementCount / 64); // 1
      passEncoder.dispatchWorkgroups(workgroupCountX, 1, 1);
      this._addLog('pass', `dispatchWorkgroups(${workgroupCountX}, 1, 1) —— 调度 ${workgroupCountX} 个工作组`);
      let indirectLine;
      if (typeof passEncoder.dispatchWorkgroupsIndirect === 'function') {
        indirectLine = '\n   pass.dispatchWorkgroupsIndirect(buffer, offset) —— 间接调度（参数从 GPU buffer 读取）可用';
      } else {
        indirectLine = '\n   pass.dispatchWorkgroupsIndirect(buffer, offset) —— 间接调度（当前环境未实现，仅展示用法）';
      }
      passEncoder.end();
      encoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, byteLength);
      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
      if (device.queue && typeof device.queue.onSubmittedWorkDone === 'function') {
        await device.queue.onSubmittedWorkDone();
      }
      this._addLog('pass', 'commandEncoder.finish() → submit([cmd]) → onSubmittedWorkDone() 完成');
      await stagingBuffer.mapAsync(MM.READ);
      const range = stagingBuffer.getMappedRange();
      const view = new Float32Array(range);
      const result = Array.from(view);
      stagingBuffer.unmap();
      const expected = srcData.map((v) => v * 2);
      this.setState({
        computeInfo:
          `完整计算管线执行流程（input × 2 → output）：\n\n` +
          `1. createBuffer × 3：input(STORAGE|COPY_DST) / output(STORAGE|COPY_SRC) / staging(COPY_DST|MAP_READ)，均 ${byteLength}B\n` +
          `2. queue.writeBuffer(input, 0, [${srcData.slice(0, 8).join(', ')}…])\n` +
          `3. createBindGroupLayout + createPipelineLayout + createShaderModule\n` +
          `4. createComputePipeline({ layout: pll, compute: { module, entryPoint: 'main' } })\n` +
          `5. createBindGroup({ layout: bgl, entries: [input@0, output@1] })\n\n` +
          `6. 编码计算 pass：\n` +
          `   encoder = createCommandEncoder(); pass = beginComputePass()\n` +
          `   pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup)\n` +
          `   pass.dispatchWorkgroups(${workgroupCountX}, 1, 1)${indirectLine}\n` +
          `   pass.end(); encoder.copyBufferToBuffer(output, 0, staging, 0, ${byteLength})\n\n` +
          `7. encoder.finish() → GPUCommandBuffer；queue.submit([cmd])；onSubmittedWorkDone() ✓\n\n` +
          `8. staging.mapAsync(READ) → getMappedRange() → 读取结果：\n` +
          `   输入: [${srcData.slice(0, 8).join(', ')}…]  输出: [${result.slice(0, 8).join(', ')}…]\n` +
          `   期望: [${expected.slice(0, 8).join(', ')}…]（input × 2）\n` +
          `   说明：mock 中 writeBuffer 为空操作、getMappedRange 返回零填充 ArrayBuffer，故输出全 0；\n` +
          `         真实浏览器中输出应为 [2, 4, 6, 8, …]（input[i] × 2.0）。`,
      });
      this._addLog('pass', `计算 pass 完成：dispatch(${workgroupCountX},1,1)，输出前4=[${result.slice(0, 4).join(',')}]（mock 为 0）`);
    } catch (err) {
      this._addLog('warn', `计算 pass 失败：${err.name} - ${err.message}`);
    }
  }

  // device.createComputePipelineAsync(descriptor) → Promise<GPUComputePipeline>
  async _createPipelineAsync() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      this._addLog('async', "createComputePipelineAsync({ layout: 'auto', compute: {...} })…");
      const module = this._shaderModule || device.createShaderModule({ code: MULTIPLY_WGSL });
      const pipeline = await device.createComputePipelineAsync({
        label: 'multiply-pipeline-async',
        layout: 'auto',
        compute: { module, entryPoint: 'main', constants: {} },
      });
      this._pipeline = pipeline;
      this.setState({
        computeInfo: (this.state.computeInfo || '') +
          `\n\ncreateComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } })\n` +
          `  → Promise<GPUComputePipeline> ✓\n` +
          `  说明：layout:'auto' 让浏览器从 WGSL 自动推导 bindGroupLayout（无需手动 createBindGroupLayout）；\n` +
          `  async 版本在底层完成管线编译，避免阻塞主线程，比同步 createComputePipeline 更稳健。`,
      });
      this._addLog('async', `createComputePipelineAsync 成功（layout:'auto'）`);
    } catch (err) {
      this._addLog('warn', `createComputePipelineAsync 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. ComputePipeline + dispatchWorkgroups',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? '计算管线 ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'beginComputePass / submit'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createComputePipeline({ layout, compute: { module, entryPoint, constants } }) 同步创建计算管线；createComputePipelineAsync 异步版本（layout 可传 "auto" 自动推导）。device.createCommandEncoder() 创建命令编码器；encoder.beginComputePass(descriptor?) 开始计算 pass；passEncoder.setPipeline / setBindGroup(groupIndex, bindGroup, dynamicOffsets?) / dispatchWorkgroups(x, y?, z?) 调度 / dispatchWorkgroupsIndirect(buffer, offset) 间接调度 / end()。encoder.copyBufferToBuffer(src, srcOffset, dst, dstOffset, size) 拷贝；encoder.finish() → GPUCommandBuffer；device.queue.submit([cmd]) 提交；queue.onSubmittedWorkDone() 等待完成。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行计算 pass', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._runComputePass() }),
          this._btn('createPipelineAsync', { size: 'sm', disabled: !caps.gpu, onClick: () => this._createPipelineAsync() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '计算管线执行结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.computeInfo || '（点击「运行计算 pass」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`const pipeline = device.createComputePipeline({ layout: pll, compute: { module, entryPoint: 'main' } });
const encoder = device.createCommandEncoder();
const pass = encoder.beginComputePass();
pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup);
pass.dispatchWorkgroups(8, 1, 1);               // 调度 8 个工作组
// pass.dispatchWorkgroupsIndirect(indirectBuf, 0); // 间接调度
pass.end();
encoder.copyBufferToBuffer(output, 0, staging, 0, size);
device.queue.submit([encoder.finish()]); await device.queue.onSubmittedWorkDone();`)),
        h(Alert, {
          type: 'warning',
          message: 'storage buffer 结果需经 staging buffer 中转读取',
          description: 'storage buffer 不能直接 mapAsync（MAP_* 仅与 COPY_DST/SRC 组合）。读取计算结果的惯用法：output(STORAGE|COPY_SRC) → copyBufferToBuffer → staging(COPY_DST|MAP_READ) → mapAsync(READ) → getMappedRange。Card 5 完整演示了该流程。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：错误处理与资源释放 ===================

  // device.pushErrorScope / popErrorScope / uncapturederror / queue.onSubmittedWorkDone
  async _testErrorScopes() {
    if (!this._caps().gpu) {
      this._addLog('warn', 'navigator.gpu 不可用');
      return;
    }
    try {
      const device = await this._ensureDevice();
      if (!device) { this._addLog('warn', '无法获取 device'); return; }
      const lines = [];
      // 1. pushErrorScope('validation') + 执行可能出错的命令 + popErrorScope
      this._addLog('error', "pushErrorScope('validation') —— 开启验证错误捕获");
      if (typeof device.pushErrorScope === 'function') {
        device.pushErrorScope('validation');
      }
      // 执行一条可能触发 validation 错误的命令（创建一个尺寸为 0 的 buffer）
      try {
        const BU = _bufferUsage();
        const badBuffer = device.createBuffer({ size: 0, usage: BU.STORAGE });
        try { badBuffer.destroy(); } catch { /* noop */ }
        lines.push('执行可能出错的命令：createBuffer({ size: 0, usage: STORAGE })');
      } catch (err) {
        lines.push(`命令同步抛错：${err.name} - ${err.message}`);
      }
      let popped = null;
      if (typeof device.popErrorScope === 'function') {
        popped = await device.popErrorScope();
      }
      lines.push(`popErrorScope() → ${popped === null ? 'null（无错误）' : JSON.stringify(popped)}`);
      lines.push('  说明：pushErrorScope(filter) / popErrorScope() 捕获作用域内错误；filter ∈ "none"|"validation"|"out-of-memory"|"internal"，pop 返回 GPUError 或 null。');
      this._addLog('error', `popErrorScope → ${popped === null ? 'null' : JSON.stringify(popped)}`);

      // 2. uncapturederror 事件 + 3. onSubmittedWorkDone
      let uncapturedLine;
      if (typeof device.addEventListener === 'function') {
        const handler = (ev) => this._addLog('warn', `uncapturederror 触发：${ev?.error?.message || '(无消息)'}`);
        this._uncapturedHandler = handler;
        try {
          device.addEventListener('uncapturederror', handler);
          uncapturedLine = 'device.addEventListener("uncapturederror", cb) 已注册 —— 捕获未被 error scope 捕获的错误';
        } catch (err) {
          uncapturedLine = `addEventListener 失败：${err.message}`;
        }
      } else {
        uncapturedLine = 'device.addEventListener 不可用';
      }
      lines.push('', uncapturedLine);
      let workDoneLine;
      if (device.queue && typeof device.queue.onSubmittedWorkDone === 'function') {
        await device.queue.onSubmittedWorkDone();
        workDoneLine = 'queue.onSubmittedWorkDone() → Promise ✓（已提交任务完成）';
      } else {
        workDoneLine = 'queue.onSubmittedWorkDone 不可用';
      }
      lines.push('', workDoneLine);

      this.setState({
        errorInfo:
          `GPUDevice 错误处理与资源释放：\n\n` +
          lines.join('\n') + '\n\n' +
          `错误作用域栈（LIFO）：pushErrorScope('validation') 入栈 → ...执行命令... → popErrorScope() → Promise<GPUError|null> 出栈\n\n` +
          `filter 类型对照：'none'(不捕获) | 'validation'(验证错误，最常用) | 'out-of-memory'(内存不足) | 'internal'(内部错误)\n\n` +
          `uncapturederror：未被任何 error scope 捕获的错误会冒泡到事件，用于全局兜底监控。\n` +
          `queue.onSubmittedWorkDone()：等待队列中已提交任务全部完成。`,
      });
    } catch (err) {
      this._addLog('warn', `错误处理演示失败：${err.name} - ${err.message}`);
    }
  }

  // device.destroy() —— 销毁设备，释放所有 GPU 资源
  _destroyDevice() {
    if (!this._device) {
      this._addLog('warn', '尚无 device 可销毁');
      return;
    }
    try {
      this._addLog('release', 'device.destroy() —— 销毁设备，释放所有 GPU 资源');
      this._device.destroy();
      this.setState({
        errorInfo: (this.state.errorInfo || '') +
          `\n\ndevice.destroy() 已调用 —— GPUDevice 被销毁，所有关联资源（buffer/texture/pipeline）失效。\n` +
          `说明：destroy 后不应再使用该 device 创建资源或提交命令；componentWillUnmount 也会自动 destroy。`,
      });
      // 销毁后清理引用（避免后续卡片误用）
      this._device = this._adapter = this._buffer = this._bindGroupLayout = this._bindGroup = null;
      this._shaderModule = this._pipeline = this._inputBuffer = this._outputBuffer = this._stagingBuffer = null;
    } catch (err) {
      this._addLog('warn', `destroy 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 错误处理与资源释放',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'ErrorScope ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'validation / uncapturederror'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.pushErrorScope(filter) 入栈错误捕获作用域，filter ∈ "none"|"validation"|"out-of-memory"|"internal"；device.popErrorScope() → Promise<GPUError|null> 出栈并返回捕获的错误（LIFO 栈）。device.addEventListener("uncapturederror", cb) 监听未被任何 scope 捕获的错误（全局兜底）。device.queue.onSubmittedWorkDone() → Promise 等待已提交任务完成。device.destroy() 销毁设备，释放所有关联 GPU 资源；buffer.destroy() 释放单个 buffer。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('测试 ErrorScope', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._testErrorScopes() }),
          this._btn('destroy Device', { danger: true, size: 'sm', disabled: !caps.gpu, onClick: () => this._destroyDevice() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '错误处理 / 资源释放结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.errorInfo || '（点击「测试 ErrorScope」或「destroy Device」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } },
          h('code', {},
`device.pushErrorScope('validation');        // 入栈
device.createBuffer({ size: 0, usage: 0 });  // 可能触发验证错误
const err = await device.popErrorScope();    // 出栈 → GPUError | null
device.addEventListener('uncapturederror', (e) => console.warn(e.error.message)); // 全局兜底
await device.queue.onSubmittedWorkDone();     // 等待提交完成
device.destroy();                             // 销毁设备，释放资源`)),
        h(Alert, {
          type: 'warning',
          message: 'destroy 不可逆，调用后 device 不可再用',
          description: 'device.destroy() 立即释放所有 GPU 资源（buffer/texture/pipeline/bindGroup），后续对该 device 的任何操作都会失效。生产代码应在确认不再使用时 destroy；页面卸载（componentWillUnmount）时也应释放。error scope 是 LIFO 栈，必须 push/pop 配对。',
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
      h('h2', { class: 'section-title' }, 'WebGPU 计算管线实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'WebGPU 是 WebGL 的继任者，提供显式 GPU 资源管理与通用计算（GPGPU）能力。本页演示 GPUAdapter/GPUDevice/GPUBuffer/WGSL 计算着色器/ComputePipeline/dispatchWorkgroups/错误处理。'),
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
