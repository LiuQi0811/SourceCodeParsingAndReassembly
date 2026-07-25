// =====================================================================
// WebGPUViewTransitionsPage.js —— WebGPU / View Transitions / Popover / <dialog> 实验室
// 演示 MDN：
//   1. WebGPU API —— navigator.gpu/requestAdapter/requestDevice/GPUAdapterInfo/GPUFeatureSet/
//      GPUSupportedLimits/createBuffer/createTexture/createSampler/createShaderModule/
//      createRenderPipeline/createCommandEncoder/beginRenderPass/setPipeline/draw/finish/
//      queue.submit/pushErrorScope/popErrorScope/uncapturederror/device.destroy
//   2. View Transitions API —— document.startViewTransition(callback)/ViewTransition.ready/
//      updateCallbackDone/finished/::view-transition-old/new/group(root)/view-transition-name
//   3. Popover API —— element.popover/popoverTargetElement/popoverTargetAction/showPopover/
//      hidePopover/togglePopover/beforetoggle|toggle 事件（newState/oldState）
//   4. HTML <dialog> —— show/showModal/close/returnValue/open/close|cancel 事件/::backdrop/Top Layer
// 说明：所有 API 调用前做 typeof 能力检测，不可用时仅 _addLog('warn', ...)，绝不抛异常。
//       jsdom/Node 中 navigator.gpu/startViewTransition/showPopover 等通常不可用。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// 顶点着色器 WGSL：依据 vertex_index 取三角形三个顶点，输出裁剪空间坐标
const VERT_WGSL = `
@vertex
fn main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>( 0.0,  0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
  );
  return vec4<f32>(pos[vi], 0.0, 1.0);
}
`;

// 片元着色器 WGSL：输出纯色 RGBA（浅蓝 0.36,0.62,0.85,1.0）
const FRAG_WGSL = `
@fragment
fn main() -> @location(0) vec4<f32> {
  return vec4<f32>(0.36, 0.62, 0.85, 1.0);
}
`;

// requestAdapter 选项示例：powerPreference='low-power' 省电，'high-performance' 高性能
const ADAPTER_OPTIONS = { powerPreference: 'low-power' };

export class WebGPUViewTransitionsPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：WebGPU 入口与适配器
      adapterInfo: '',
      // Card 2：WebGPU 资源创建
      resourceInfo: '',
      // Card 3：WebGPU 渲染流程
      renderInfo: '',
      // Card 4：View Transitions
      transitionInfo: '',
      // Card 5：Popover API
      popoverInfo: '',
      // Card 6：<dialog> 元素
      dialogInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._adapter = null; this._device = null;             // Card 1 GPUAdapter / GPUDevice
    this._buffer = null; this._texture = null; this._sampler = null;  // Card 2 GPUBuffer/Texture/Sampler
    this._shaderModule = null; this._pipeline = null;      // Card 2 GPUShaderModule / GPURenderPipeline
    this._bindGroupLayout = null; this._bindGroup = null; this._errorHandler = null; // Card 2 bindGroup + uncapturederror
    this._transitionEl = null;                             // Card 4 演示过渡用的容器
    this._popover = null; this._popoverToggleHandler = null;        // Card 5 popover + toggle 监听
    this._dialog = null; this._dialogCloseHandler = null; this._dialogCancelHandler = null; // Card 6 dialog + close/cancel

    // 一次性能力检测：WebGPU 全家桶 + View Transitions + Popover + <dialog>
    const hasGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
    const hasRequestAdapter = hasGPU && typeof navigator.gpu.requestAdapter === 'function';
    const hasViewTransition = typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
    const hasPopover = typeof document !== 'undefined' && typeof document.createElement('div').showPopover === 'function';
    const hasDialog = typeof HTMLDialogElement !== 'undefined';
    const hasShowModal = hasDialog && typeof document.createElement('dialog').showModal === 'function';

    const parts = [
      `navigator.gpu ${hasGPU ? '✓' : '✗'}`, `requestAdapter ${hasRequestAdapter ? '✓' : '✗'}`, `startViewTransition ${hasViewTransition ? '✓' : '✗'}`,
      `Popover API ${hasPopover ? '✓' : '✗'}`, `<dialog> ${hasDialog ? '✓' : '✗'}`, `showModal ${hasShowModal ? '✓' : '✗'}`,
    ];

    const allOk = hasGPU && hasViewTransition && hasPopover && hasDialog;
    const summary = `能力检测：${parts.join(' · ')}。${allOk ? '当前环境支持所有演示 API，可执行真实流程。' : 'jsdom/Node 等测试环境通常不支持 navigator.gpu / document.startViewTransition / showPopover，相应按钮点击仅记日志说明"测试环境不支持，请用真实浏览器"。'}`;

    this.setState({ capsSummary: summary });
    this._addLog(hasGPU ? 'info' : 'warn', `WebGPU：${hasGPU ? '可用' : '不可用（navigator.gpu 未定义）'}`);
    if (!hasViewTransition) this._addLog('warn', 'document.startViewTransition 不可用（需 Chrome 111+ 真实浏览器）');
    if (!hasPopover) this._addLog('warn', 'Popover API 不可用（showPopover 未定义，需 Chrome 114+）');
    if (!hasDialog) this._addLog('warn', 'HTMLDialogElement 不可用');
  }

  componentWillUnmount() {
    // 释放 WebGPU 资源（device.destroy 会回收所有派生资源）
    const detach = (target, type, handler) => {
      if (target && handler) { try { target.removeEventListener(type, handler); } catch { /* noop */ } }
    };
    const remove = (el) => { if (el && el.parentNode) el.parentNode.removeChild(el); };
    if (this._device && typeof this._device.destroy === 'function') { try { this._device.destroy(); } catch { /* noop */ } }
    detach(this._device, 'uncapturederror', this._errorHandler);
    detach(this._popover, 'toggle', this._popoverToggleHandler);
    detach(this._dialog, 'close', this._dialogCloseHandler);
    detach(this._dialog, 'cancel', this._dialogCancelHandler);
    remove(this._transitionEl); remove(this._popover); remove(this._dialog);
    this._adapter = null; this._device = null; this._buffer = null; this._texture = null;
    this._sampler = null; this._shaderModule = null; this._pipeline = null;
    this._bindGroupLayout = null; this._bindGroup = null; this._errorHandler = null;
    this._transitionEl = null; this._popover = null; this._popoverToggleHandler = null;
    this._dialog = null; this._dialogCloseHandler = null; this._dialogCancelHandler = null;
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
    const hasGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
    const hasDialog = typeof HTMLDialogElement !== 'undefined';
    const tryProbe = (fn) => { try { return fn(); } catch { return false; } };
    const popover = tryProbe(() => typeof document !== 'undefined' && typeof document.createElement('div').showPopover === 'function');
    const showModal = tryProbe(() => hasDialog && typeof document !== 'undefined' && typeof document.createElement('dialog').showModal === 'function');
    return {
      gpu: hasGPU,
      requestAdapter: hasGPU && typeof navigator.gpu.requestAdapter === 'function',
      viewTransition: typeof document !== 'undefined' && typeof document.startViewTransition === 'function',
      popover, dialog: hasDialog, showModal,
    };
  }

  // =================== Card 1：WebGPU 入口与适配器 ===================

  // navigator.gpu.requestAdapter({ powerPreference, forceSoftware }) → Promise<GPUAdapter|null>
  async _requestAdapter() {
    const caps = this._caps();
    if (!caps.requestAdapter) {
      this._addLog('warn', 'navigator.gpu.requestAdapter 不可用：测试环境不支持，请用真实浏览器（Chrome 113+）');
      this.setState({ adapterInfo: '当前环境不支持 WebGPU（typeof navigator.gpu === "undefined"）。\n请用支持 WebGPU 的真实浏览器（Chrome 113+/Edge 113+）打开本页。' });
      return;
    }
    try {
      this._addLog('adapter', `navigator.gpu.requestAdapter(${JSON.stringify(ADAPTER_OPTIONS)})…`);
      const adapter = await navigator.gpu.requestAdapter(ADAPTER_OPTIONS);
      if (!adapter) {
        this._addLog('warn', 'requestAdapter 返回 null（无可用 GPU 适配器）');
        this.setState({ adapterInfo: 'requestAdapter() 返回 null：系统没有可用的 GPU 适配器，可能被用户禁用或硬件不支持。' });
        return;
      }
      this._adapter = adapter;
      const info = adapter.info || {};                          // GPUAdapterInfo：vendor/architecture/description
      const features = adapter.features ? Array.from(adapter.features) : []; // GPUFeatureSet（Set-like）
      const limits = adapter.limits || {};                      // GPUSupportedLimits
      const limitKeys = ['maxTextureDimension2D', 'maxTextureDimension1D', 'maxTextureDimension3D',
        'maxBufferSize', 'maxBindGroups', 'maxVertexBuffers', 'maxStorageBuffersPerShaderStage'];
      const limitLines = limitKeys.map((k) => `${k} = ${limits[k] ?? 'n/a'}`);
      this.setState({
        adapterInfo:
          `navigator.gpu.requestAdapter(${JSON.stringify(ADAPTER_OPTIONS)}) → GPUAdapter ✓\n` +
          `adapter.info（GPUAdapterInfo）：vendor=${info.vendor ?? 'n/a'}，architecture=${info.architecture ?? 'n/a'}，description=${info.description ?? 'n/a'}，device=${info.device ?? 'n/a'}\n\n` +
          `adapter.features（GPUFeatureSet，共 ${features.length} 项）：\n${features.length ? features.map((f) => `  • ${f}`).join('\n') : '  （空集）'}\n\n` +
          `adapter.limits（GPUSupportedLimits，节选）：\n${limitLines.map((l) => `  ${l}`).join('\n')}`,
      });
      this._addLog('adapter', `已获取 adapter：vendor=${info.vendor ?? '?'}, features=${features.length} 项`);
    } catch (err) {
      this._addLog('warn', `requestAdapter 抛错：${err.name} - ${err.message}`);
    }
  }

  // adapter.requestDevice({ requiredFeatures, requiredLimits, label }) → Promise<GPUDevice>
  async _requestDevice() {
    const caps = this._caps();
    if (!caps.requestAdapter) {
      this._addLog('warn', 'requestDevice 不可用：navigator.gpu 缺失');
      return;
    }
    if (!this._adapter) {
      this._addLog('warn', '请先点击「requestAdapter」获取适配器');
      return;
    }
    try {
      this._addLog('device', 'adapter.requestDevice({ label: "demo-device" })…');
      const device = await this._adapter.requestDevice({ label: 'demo-device' });
      this._device = device;
      // 注册 uncapturederror 监听器：捕获未被 pushErrorScope 捕获的错误
      if (typeof device.addEventListener === 'function') {
        this._errorHandler = (ev) => {
          const err = ev?.error;
          this._addLog('warn', `uncapturederror：${err?.name || 'Error'} - ${err?.message || ''}`);
        };
        device.addEventListener('uncapturederror', this._errorHandler);
      }
      const queueLabel = device.queue?.label || '(默认)';
      this.setState({
        adapterInfo:
          (this.state.adapterInfo || '') + '\n\n' +
          `adapter.requestDevice({ label: "demo-device" }) → GPUDevice ✓\n` +
          `device.label = ${device.label || '(空)'}，device.queue.label = ${queueLabel}，device.limits ${device.limits ? '可用' : 'n/a'}\n` +
          `device.queue（GPUQueue）：writeBuffer / writeTexture / submit / onSubmittedWorkDone\n已注册 uncapturederror 监听器（捕获未被 pushErrorScope 捕获的错误）。device 是资源创建入口，用完应 destroy()。`,
      });
      this._addLog('device', `已创建 device：label="${device.label}"，queue 已就绪，已挂 uncapturederror 监听`);
    } catch (err) {
      this._addLog('warn', `requestDevice 抛错：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. WebGPU 入口与适配器',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'navigator.gpu ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'requestAdapter / requestDevice'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.gpu 是 WebGPU 入口；gpu.requestAdapter({ powerPreference: "low-power"|"high-performance", forceSoftware }) → Promise<GPUAdapter|null>。adapter.info（GPUAdapterInfo：vendor/architecture/description）描述硬件；adapter.features（GPUFeatureSet，Set-like）列出可用特性；adapter.limits（GPUSupportedLimits：maxTextureDimension2D 等）描述资源上限。adapter.requestDevice(descriptor) → Promise<GPUDevice>，device 是所有资源创建入口，使用后应 destroy()。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('requestAdapter', { type: 'primary', size: 'sm', disabled: !caps.requestAdapter, onClick: () => this._requestAdapter() }),
          this._btn('requestDevice', { type: 'primary', size: 'sm', disabled: !caps.requestAdapter, onClick: () => this._requestDevice() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'adapter / device 信息：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.adapterInfo || '（点击 requestAdapter / requestDevice）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
console.log(adapter.info.vendor, adapter.info.architecture);
const features = [...adapter.features];           // GPUFeatureSet → Array
console.log(adapter.limits.maxTextureDimension2D);
const device = await adapter.requestDevice({ label: 'demo' });
device.addEventListener('uncapturederror', (e) => console.error(e.error));
// ... 用完调用 device.destroy()`)),
        h(Alert, {
          type: 'info',
          message: 'requestAdapter 可能返回 null',
          description: '用户禁用 GPU、系统无合适适配器或浏览器策略不允许时，requestAdapter 解析为 null。务必判空。powerPreference 是提示而非强制；forceSoftware: true 用软件实现（调试用）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：WebGPU 资源创建 ===================

  // device.createBuffer({ size, usage }) → GPUBuffer
  _createBuffer() {
    const caps = this._caps();
    if (!caps.gpu) { this._addLog('warn', 'WebGPU 不可用：测试环境不支持，请用真实浏览器'); return; }
    if (!this._device) { this._addLog('warn', '请先在 Card 1 点击「requestDevice」'); return; }
    try {
      // usage 用位掩码：VERTEX | COPY_DST（顶点缓冲 + 写入目标）
      const USAGE = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
      const buffer = this._device.createBuffer({ size: 24, usage: USAGE, label: 'demo-vertex-buffer' });
      this._buffer = buffer;
      const bufUsageLine = ['VERTEX', 'INDEX', 'UNIFORM', 'STORAGE', 'COPY_SRC', 'COPY_DST', 'MAP_READ', 'MAP_WRITE']
        .map((k) => `${k}=${GPUBufferUsage[k]}`).join(' / ');
      this.setState({
        resourceInfo:
          `device.createBuffer({ size: 24, usage: VERTEX|COPY_DST, label: 'demo-vertex-buffer' }) → GPUBuffer ✓\n` +
          `buffer.size = ${buffer.size}（字节），usage = ${buffer.usage}（位掩码），label = ${buffer.label || '(空)'}\n` +
          `buffer.mapState = ${buffer.mapState}（unmapped / mapped / destroyed）\n\nGPUBufferUsage 位掩码（参考）：${bufUsageLine}`,
      });
      this._addLog('buffer', `已创建 buffer：size=${buffer.size}, usage=${buffer.usage}`);
    } catch (err) {
      this._addLog('warn', `createBuffer 抛错：${err.name} - ${err.message}`);
    }
  }

  // device.createTexture({ size, format, usage }) → GPUTexture
  _createTexture() {
    const caps = this._caps();
    if (!caps.gpu) { this._addLog('warn', 'WebGPU 不可用：测试环境不支持，请用真实浏览器'); return; }
    if (!this._device) { this._addLog('warn', '请先在 Card 1 点击「requestDevice」'); return; }
    try {
      const USAGE = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC;
      const texture = this._device.createTexture({
        size: [256, 256],
        format: navigator.gpu.getPreferredCanvasFormat ? navigator.gpu.getPreferredCanvasFormat() : 'bgra8unorm',
        usage: USAGE, label: 'demo-texture',
      });
      this._texture = texture;
      const view = texture.createView ? texture.createView() : null;
      const texUsageLine = ['RENDER_ATTACHMENT', 'COPY_SRC', 'COPY_DST', 'TEXTURE_BINDING', 'STORAGE_BINDING']
        .map((k) => `${k}=${GPUTextureUsage[k]}`).join(' / ');
      this.setState({
        resourceInfo:
          (this.state.resourceInfo || '') + '\n\n' +
          `device.createTexture({ size: [256,256], format, usage, label }) → GPUTexture ✓\n` +
          `texture.format = ${texture.format}，width = ${texture.width}，height = ${texture.height}，usage = ${texture.usage}\n` +
          `mipLevelCount = ${texture.mipLevelCount}，sampleCount = ${texture.sampleCount}，createView() → ${view ? 'GPUTextureView ✓' : 'n/a'}\n\n` +
          `GPUTextureUsage 位掩码（参考）：${texUsageLine}`,
      });
      this._addLog('texture', `已创建 texture：${texture.width}x${texture.height}, format=${texture.format}`);
    } catch (err) {
      this._addLog('warn', `createTexture 抛错：${err.name} - ${err.message}`);
    }
  }

  // device.createSampler(descriptor) → GPUSampler
  _createSampler() {
    const caps = this._caps();
    if (!caps.gpu) { this._addLog('warn', 'WebGPU 不可用：测试环境不支持，请用真实浏览器'); return; }
    if (!this._device) { this._addLog('warn', '请先在 Card 1 点击「requestDevice」'); return; }
    try {
      const sampler = this._device.createSampler({
        magFilter: 'linear', minFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', label: 'demo-sampler',
      });
      this._sampler = sampler;
      this.setState({
        resourceInfo:
          (this.state.resourceInfo || '') + '\n\n' +
          `device.createSampler({ magFilter, minFilter, addressModeU/V, label }) → GPUSampler ✓，label = ${sampler.label || '(空)'}\n` +
          `说明：sampler 控制纹理采样方式（过滤 / 寻址 / 各向异性 / 比较）。`,
      });
      this._addLog('sampler', `已创建 sampler：label="${sampler.label}"`);
    } catch (err) {
      this._addLog('warn', `createSampler 抛错：${err.name} - ${err.message}`);
    }
  }

  // device.createShaderModule({ code }) → GPUShaderModule（WGSL 源码）
  _createShader() {
    const caps = this._caps();
    if (!caps.gpu) { this._addLog('warn', 'WebGPU 不可用：测试环境不支持，请用真实浏览器'); return; }
    if (!this._device) { this._addLog('warn', '请先在 Card 1 点击「requestDevice」'); return; }
    try {
      const module = this._device.createShaderModule({ code: VERT_WGSL + '\n' + FRAG_WGSL, label: 'demo-shader' });
      this._shaderModule = module;
      this.setState({
        resourceInfo:
          (this.state.resourceInfo || '') + '\n\n' +
          `device.createShaderModule({ code, label }) → GPUShaderModule ✓，label = ${module.label || '(空)'}\n` +
          `代码语言：WGSL（WebGPU Shading Language，替代 GLSL）；getCompilationInfo() 可获取编译诊断信息。`,
      });
      this._addLog('shader', `已创建 shaderModule：label="${module.label}"（WGSL）`);
    } catch (err) {
      this._addLog('warn', `createShaderModule 抛错：${err.name} - ${err.message}`);
    }
  }

  // device.createRenderPipeline({ layout, vertex, fragment, primitive }) → GPURenderPipeline
  _createPipeline() {
    const caps = this._caps();
    if (!caps.gpu) { this._addLog('warn', 'WebGPU 不可用：测试环境不支持，请用真实浏览器'); return; }
    if (!this._device) { this._addLog('warn', '请先在 Card 1 点击「requestDevice」，并先创建 shaderModule'); return; }
    if (!this._shaderModule) { this._addLog('warn', '请先点击「createShaderModule」'); return; }
    try {
      const format = navigator.gpu.getPreferredCanvasFormat ? navigator.gpu.getPreferredCanvasFormat() : 'bgra8unorm';
      const pipeline = this._device.createRenderPipeline({
        label: 'demo-pipeline',
        layout: 'auto',     // 让 WebGPU 自动推断 bindGroupLayout
        vertex: { module: this._shaderModule, entryPoint: 'main' },
        fragment: { module: this._shaderModule, entryPoint: 'main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      this._pipeline = pipeline;
      // layout: 'auto' 时可读 pipeline.getBindGroupLayout(0)
      let bglLine = '';
      try { this._bindGroupLayout = pipeline.getBindGroupLayout(0); bglLine = 'pipeline.getBindGroupLayout(0) → GPUBindGroupLayout ✓\n'; }
      catch (e) { bglLine = `getBindGroupLayout(0) 抛错：${e.message}\n`; }
      this.setState({
        resourceInfo:
          (this.state.resourceInfo || '') + '\n\n' +
          `device.createRenderPipeline({ layout: 'auto', vertex, fragment, primitive }) → GPURenderPipeline ✓，label = ${pipeline.label || '(空)'}\n` +
          bglLine +
          `说明：pipeline 是不可变对象（含 GPU 编译产物）；layout:'auto' 自动推断绑定组布局；primitive.topology='triangle-list'。`,
      });
      this._addLog('pipeline', `已创建 renderPipeline：label="${pipeline.label}"，topology=triangle-list`);
    } catch (err) {
      this._addLog('warn', `createRenderPipeline 抛错：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. WebGPU 资源创建',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'Resource ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'buffer/texture/sampler/shader/pipeline'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createBuffer({ size, usage }) 创建顶点/索引/Uniform/Storage 缓冲；device.createTexture({ size, format, usage }) 创建可渲染/可采样纹理，texture.createView() 生成 GPUTextureView；device.createSampler({ magFilter, minFilter, addressModeU/V }) 控制采样；device.createShaderModule({ code }) 编译 WGSL；device.createRenderPipeline({ layout:"auto", vertex, fragment, primitive }) 创建不可变渲染管线。usage 用 GPUBufferUsage / GPUTextureUsage 位掩码按位或。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('createBuffer', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createBuffer() }),
          this._btn('createTexture', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createTexture() }),
          this._btn('createSampler', { size: 'sm', disabled: !caps.gpu, onClick: () => this._createSampler() }),
          this._btn('createShaderModule', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createShader() }),
          this._btn('createRenderPipeline', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._createPipeline() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '资源创建结果（依次追加）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.resourceInfo || '（依次点击各按钮，建议顺序：buffer → texture → sampler → shader → pipeline）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '演示用的 WGSL（顶点 + 片元）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, '// 顶点：依据 vertex_index 取三角形三个顶点\n' + VERT_WGSL + '\n// 片元：输出纯色\n' + FRAG_WGSL)),
        h(Alert, {
          type: 'warning',
          message: 'usage 位掩码不可后期修改',
          description: 'GPUBuffer / GPUTexture 的 usage 在创建时确定，后续操作必须与之匹配，否则 pushErrorScope / uncapturederror 抛 validation 错误。size 必须是 4 的倍数。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：WebGPU 渲染流程 ===================

  // createCommandEncoder → beginRenderPass → setPipeline/draw/end → finish → queue.submit
  _encodeAndSubmit() {
    const caps = this._caps();
    if (!caps.gpu) { this._addLog('warn', 'WebGPU 不可用：测试环境不支持，请用真实浏览器'); return; }
    if (!this._device) { this._addLog('warn', '请先在 Card 1 点击「requestDevice」'); return; }
    if (!this._pipeline) { this._addLog('warn', '请先在 Card 2 点击「createRenderPipeline」'); return; }
    if (!this._texture) { this._addLog('warn', '请先在 Card 2 点击「createTexture」'); return; }
    try {
      // 1) 推入 error scope 捕获校验错误；2) 创建 command encoder
      this._device.pushErrorScope('validation');
      const encoder = this._device.createCommandEncoder({ label: 'demo-encoder' });
      // 3) texture.createView() → 颜色附件 view；4) beginRenderPass 描述颜色附件
      const passEncoder = encoder.beginRenderPass({
        label: 'demo-pass',
        colorAttachments: [{ view: this._texture.createView(), clearValue: { r: 0.1, g: 0.12, b: 0.15, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }],
      });
      // 5) setPipeline（本演示管线无 bindGroup/vertexBuffer，用 vertex_index 取顶点）；6) draw 绘制三角形
      passEncoder.setPipeline(this._pipeline);
      passEncoder.draw(3, 1, 0, 0);
      // 7-9) pass.end() + encoder.finish() → GPUCommandBuffer + queue.submit 提交到 GPU
      passEncoder.end();
      const commandBuffer = encoder.finish();
      this._device.queue.submit([commandBuffer]);
      // 10) onSubmittedWorkDone() → Promise<void>（GPU 完成提交工作）；11) popErrorScope 弹出错误域
      let doneLine = '';
      if (typeof this._device.queue.onSubmittedWorkDone === 'function') {
        this._device.queue.onSubmittedWorkDone().then(() => {
          this._addLog('submit', 'queue.onSubmittedWorkDone() resolve（GPU 完成提交工作）');
        }).catch((e) => this._addLog('warn', `onSubmittedWorkDone reject：${e.message}`));
        doneLine = 'queue.onSubmittedWorkDone() → Promise（已发起，resolve 后记日志）\n';
      }
      this._device.popErrorScope().then((err) => {
        if (err) this._addLog('warn', `popErrorScope 捕获错误：${err.name} - ${err.message}`);
        else this._addLog('submit', 'popErrorScope resolve(null)：本段编码无 validation 错误');
      }).catch((e) => this._addLog('warn', `popErrorScope reject：${e.message}`));
      this.setState({
        renderInfo:
          `完整渲染流程（已 submit）：\n` +
          `1) pushErrorScope('validation')  2) createCommandEncoder()  3) texture.createView()\n` +
          `4) beginRenderPass({ colorAttachments:[{view,loadOp:'clear',storeOp:'store',clearValue}] })\n` +
          `5) setPipeline(pipeline)  6) draw(3,1,0,0) —— 绘制 3 个顶点（三角形）\n` +
          `7) pass.end()  8) encoder.finish() → GPUCommandBuffer\n` +
          `9) queue.submit([commandBuffer])  10) ${doneLine}11) popErrorScope()\n\n` +
          `encoder.label = ${encoder.label || '(空)'}\ncommandBuffer 已提交，GPU 异步执行；onSubmittedWorkDone 与 popErrorScope 异步记日志。`,
      });
      this._addLog('submit', `已 submit commandBuffer：draw(3) 绘制三角形，clearValue=(0.1,0.12,0.15,1)`);
    } catch (err) {
      this._addLog('warn', `渲染流程抛错：${err.name} - ${err.message}`);
      this.setState({ renderInfo: `渲染流程抛错：${err.name} - ${err.message}` });
    }
  }

  // device.queue.writeBuffer(buffer, offset, data) —— 把顶点数据写入 buffer
  _writeBuffer() {
    const caps = this._caps();
    if (!caps.gpu) { this._addLog('warn', 'WebGPU 不可用：测试环境不支持，请用真实浏览器'); return; }
    if (!this._device) { this._addLog('warn', '请先在 Card 1 点击「requestDevice」'); return; }
    if (!this._buffer) { this._addLog('warn', '请先在 Card 2 点击「createBuffer」'); return; }
    try {
      // 6 个 float32 = 24 字节，对应三个二维顶点
      const data = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);
      this._device.queue.writeBuffer(this._buffer, 0, data);
      // 演示 writeTexture：往 texture 写入一片 RGBA 像素
      let texLine = '';
      if (this._texture) {
        try {
          const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]);
          this._device.queue.writeTexture({ texture: this._texture, mipLevel: 0, origin: [0, 0, 0] }, pixels, { bytesPerRow: 8, rowsPerImage: 2 }, [2, 2, 1]);
          texLine = `\nqueue.writeTexture(texture, RGBA 像素 [4 个], { bytesPerRow:8, rowsPerImage:2 }, [2,2,1]) ✓`;
        } catch (e) {
          texLine = `\nwriteTexture 抛错：${e.message}`;
        }
      }
      this.setState({
        renderInfo:
          (this.state.renderInfo || '') + '\n\n' +
          `device.queue.writeBuffer(buffer, 0, Float32Array([0,0.5,-0.5,-0.5,0.5,-0.5])) ✓\n` +
          `写入 ${data.byteLength} 字节（6 个 float32 = 3 个二维顶点）${texLine}\n\n` +
          `说明：writeBuffer / writeTexture 是 queue 上的便捷方法，会在 submit 之前按队列顺序执行，省去 mapAsync 的同步开销。`,
      });
      this._addLog('queue', `queue.writeBuffer 写入 ${data.byteLength}B；${this._texture ? 'writeTexture ✓' : '无 texture'}`);
    } catch (err) {
      this._addLog('warn', `writeBuffer 抛错：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. WebGPU 渲染流程',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'Render ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'commandEncoder / beginRenderPass / draw / submit'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createCommandEncoder() 创建命令编码器；encoder.beginRenderPass({ colorAttachments: [{ view, loadOp, storeOp, clearValue }] }) 开启渲染通道；passEncoder.setPipeline(pipeline) / setBindGroup(0, bg) / setVertexBuffer(0, buffer) 绑定资源；passEncoder.draw(vertexCount, instanceCount, firstVertex, firstInstance) 发起绘制；passEncoder.end() 结束通道；encoder.finish() → GPUCommandBuffer；device.queue.submit([commandBuffer]) 提交到 GPU。device.pushErrorScope("validation") / popErrorScope() 用于捕获校验错误；device.addEventListener("uncapturederror", ...) 捕获未捕获错误。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('queue.writeBuffer', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._writeBuffer() }),
          this._btn('编码并 submit', { type: 'primary', size: 'sm', disabled: !caps.gpu, onClick: () => this._encodeAndSubmit() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '渲染流程结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.renderInfo || '（前置：Card 1 requestDevice → Card 2 createTexture + createShaderModule + createRenderPipeline）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`device.pushErrorScope('validation');
const encoder = device.createCommandEncoder();
const pass = encoder.beginRenderPass({
  colorAttachments: [{ view: texture.createView(), clearValue: { r:0.1,g:0.12,b:0.15,a:1 }, loadOp:'clear', storeOp:'store' }],
});
pass.setPipeline(pipeline); pass.setVertexBuffer(0, vertexBuffer);
pass.draw(3, 1, 0, 0); pass.end();
device.queue.submit([encoder.finish()]);
device.popErrorScope().then(err => err && console.error(err));`)),
        h(Alert, {
          type: 'info',
          message: 'WebGPU 是显式、低开销的命令录制模型',
          description: '与 WebGL 即时模式不同，WebGPU 先把所有命令录制到 CommandEncoder，再一次性 submit，便于多线程录制（worker）、减少状态切换开销。pushErrorScope / popErrorScope 与 uncapturederror 是错误捕获的两大手段。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：View Transitions API ===================

  // document.startViewTransition(callback) → ViewTransition（ready/updateCallbackDone/finished）
  async _startViewTransition() {
    const caps = this._caps();
    if (!caps.viewTransition) {
      this._addLog('warn', 'document.startViewTransition 不可用：测试环境不支持，请用真实浏览器（Chrome 111+）');
      this.setState({
        transitionInfo:
          `当前环境不支持 View Transitions API（typeof document.startViewTransition === "undefined"）。\n` +
          `请用 Chrome 111+ 真实浏览器打开本页。\n` +
          `本应演示：document.startViewTransition(callback) → ViewTransition，\n  以及 ready / updateCallbackDone / finished 三个 Promise 的时序，\n  ::view-transition-old/new/group(root) 伪元素与 view-transition-name CSS 属性。`,
      });
      return;
    }
    try {
      // 准备演示容器（首次创建）
      if (!this._transitionEl) {
        this._transitionEl = document.createElement('div');
        this._transitionEl.style.cssText = 'padding:12px;border:2px solid #5b9bf5;border-radius:8px;margin:8px 0;background:#f5f9ff;';
        this._transitionEl.dataset.count = '0';
        this._transitionEl.textContent = '点击次数：0（即将过渡到下一种背景色）';
        // 挂到当前页面 DOM（el 已绑定）
        if (this.el) this.el.appendChild(this._transitionEl);
      }
      const before = this._transitionEl.dataset.count;
      this._addLog('vt', `document.startViewTransition(callback) 发起过渡（当前 count=${before}）`);
      // callback 在 DOM 更新前调用，更新后开始动画
      const transition = document.startViewTransition(() => {
        const next = Number(before) + 1;
        this._transitionEl.dataset.count = String(next);
        const colors = ['#f5f9ff', '#fff5f0', '#f0fff5', '#faf0ff'];
        this._transitionEl.style.background = colors[next % colors.length];
        this._transitionEl.textContent = `点击次数：${next}（背景色已切换）`;
      });
      // 三个 Promise 时序：updateCallbackDone（callback 完成）→ ready（动画可开始）→ finished（动画结束）
      const timing = { update: null, ready: null, finished: null };
      const t0 = performance.now();
      const ms = (k) => (timing[k] = performance.now() - t0).toFixed(1);
      transition.updateCallbackDone.then(() => this._addLog('vt', `updateCallbackDone resolve（DOM 已更新，耗时 ${ms('update')}ms）`))
        .catch((e) => this._addLog('warn', `updateCallbackDone reject：${e.message}`));
      transition.ready.then(() => this._addLog('vt', `ready resolve（伪元素就绪，开始动画，耗时 ${ms('ready')}ms）`))
        .catch((e) => this._addLog('warn', `ready reject：${e.message}`));
      transition.finished.then(() => {
        this._addLog('vt', `finished resolve（过渡完成，耗时 ${ms('finished')}ms）`);
        const now = this._transitionEl.dataset.count;
        this.setState({
          transitionInfo:
            `document.startViewTransition(callback) → ViewTransition ✓，当前 count = ${now}\n` +
            `updateCallbackDone resolve：DOM 已更新（耗时 ${timing.update?.toFixed(1)}ms）\n` +
            `ready resolve：伪元素就绪，开始动画（耗时 ${timing.ready?.toFixed(1)}ms）\n` +
            `finished resolve：过渡完成（耗时 ${timing.finished?.toFixed(1)}ms）\n\n` +
            `时序：updateCallbackDone → ready → finished。DOM 更新在 callback 内；浏览器自动为旧/新快照生成 ::view-transition-old/new 伪元素交叉淡入。\n::view-transition-group(root) 包裹整体；view-transition-name 可命名特定元素单独参与过渡。`,
        });
      }).catch((e) => {
        this._addLog('warn', `finished reject：${e.message}`);
        this.setState({ transitionInfo: `过渡被跳过或失败：${e.message}` });
      });
    } catch (err) {
      this._addLog('warn', `startViewTransition 抛错：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. View Transitions API',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.viewTransition ? 'success' : 'error' }, caps.viewTransition ? 'startViewTransition ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'ready / updateCallbackDone / finished'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.startViewTransition(callback) → ViewTransition：在 callback 内更新 DOM，浏览器自动捕获旧/新快照并用 ::view-transition-old / ::view-transition-new 伪元素交叉淡入淡出。ViewTransition 暴露三个 Promise：updateCallbackDone（callback 完成，DOM 已更新）→ ready（伪元素就绪，动画可开始）→ finished（动画结束）。::view-transition-group(root) 包裹整体；view-transition-name CSS 属性可为特定元素命名，让其独立参与过渡（同页 SPA 路由切换非常实用）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('startViewTransition', { type: 'primary', size: 'sm', disabled: !caps.viewTransition, onClick: () => this._startViewTransition() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '过渡时序记录：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.transitionInfo || '（点击 startViewTransition，会在下方容器上切换背景色并记录三个 Promise 的时序）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const t = document.startViewTransition(() => {
  el.textContent = 'new content';   // 在 callback 内更新 DOM
});
t.updateCallbackDone.then(() => console.log('DOM 已更新'));
t.ready.then(() => console.log('动画开始'));
t.finished.then(() => console.log('过渡完成'));

/* CSS 配合：
::view-transition-old(root), ::view-transition-new(root) { animation-duration: .4s; }
.hero { view-transition-name: hero; }   /* 命名元素独立过渡 */`)),
        h(Alert, {
          type: 'info',
          message: 'View Transitions 让 SPA 路由切换也能有原生过渡',
          description: '无需引入动画库，startViewTransition 自动捕获快照并交叉淡入；配合 view-transition-name 可在两页间对同名元素做位置/尺寸过渡（如列表项到详情图）。updateCallbackDone 在 ready 之前 resolve，可用于"DOM 已更新但动画未完"的中间态。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：Popover API ===================

  // 创建带 popover 属性的 div，监听 toggle 事件
  _createPopover() {
    const caps = this._caps();
    if (!caps.popover) {
      this._addLog('warn', 'Popover API 不可用：showPopover 未定义，测试环境不支持，请用真实浏览器（Chrome 114+）');
      this.setState({
        popoverInfo:
          `当前环境不支持 Popover API（typeof element.showPopover === "function" 为 false）。\n` +
          `请用 Chrome 114+ 真实浏览器打开本页。\n` +
          `本应演示：element.popover = 'auto'|'manual'|null；\n  showPopover() / hidePopover() / togglePopover()；\n  beforetoggle / toggle 事件（newState/oldState: 'open'|'closed'）；\n  popovertarget HTML 属性 + 按钮（声明式触发）。`,
      });
      return;
    }
    try {
      // 已存在则先移除
      if (this._popover && this._popover.parentNode) this._popover.parentNode.removeChild(this._popover);
      const pop = document.createElement('div');
      pop.popover = 'auto';        // auto：点击外部或按 Esc 自动关闭；manual：需手动 hidePopover
      pop.textContent = '我是 Popover 弹层（popover="auto"），点击外部或 Esc 自动关闭。';
      pop.style.cssText = 'padding:12px;border:1px solid #5b9bf5;border-radius:8px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.15);';
      pop.setAttribute('id', 'demo-popover');
      // 监听 toggle 事件：newState/oldState ∈ 'open'|'closed'
      this._popoverToggleHandler = (ev) => {
        this._addLog('toggle', `Popover toggle 事件：oldState=${ev.oldState} → newState=${ev.newState}`);
        this.setState({ popoverInfo: (this.state.popoverInfo || '') + '\n' + `toggle 事件：oldState=${ev.oldState} → newState=${ev.newState}（${formatTime()}）` });
      };
      pop.addEventListener('toggle', this._popoverToggleHandler);
      // 挂到 document.body 才能 showPopover（top layer）
      document.body.appendChild(pop);
      this._popover = pop;
      this._addLog('popover', `已创建 popover：popover="auto"，已挂 toggle 监听`);
      this.setState({
        popoverInfo:
          `document.createElement('div') + div.popover = 'auto' ✓，已 append 到 document.body（top layer 渲染）\n` +
          `已监听 toggle 事件（newState/oldState ∈ open|closed）\n\n` +
          `属性对照：\n` +
          `  popover = 'auto'：点击外部或 Esc 自动关闭，同一时刻只允许一个 auto popover 打开\n  popover = 'manual'：不自动关闭，需手动 hidePopover() / togglePopover()\n  popover = null：取消 popover 行为，回到普通元素`,
      });
    } catch (err) {
      this._addLog('warn', `创建 popover 抛错：${err.name} - ${err.message}`);
    }
  }

  _showPopover() {
    if (!this._popover) { this._addLog('warn', '请先点击「创建 Popover」'); return; }
    if (typeof this._popover.showPopover !== 'function') { this._addLog('warn', 'showPopover 不可用'); return; }
    try {
      this._popover.showPopover();
      this._addLog('popover', `showPopover() 已调用（open=${this._popover.matches(':popover-open')}）`);
    } catch (err) {
      this._addLog('warn', `showPopover 抛错：${err.name} - ${err.message}`);
    }
  }

  _hidePopover() {
    if (!this._popover) { this._addLog('warn', '请先点击「创建 Popover」'); return; }
    if (typeof this._popover.hidePopover !== 'function') { this._addLog('warn', 'hidePopover 不可用'); return; }
    try {
      this._popover.hidePopover();
      this._addLog('popover', `hidePopover() 已调用`);
    } catch (err) {
      this._addLog('warn', `hidePopover 抛错：${err.name} - ${err.message}`);
    }
  }

  _togglePopover() {
    if (!this._popover) { this._addLog('warn', '请先点击「创建 Popover」'); return; }
    if (typeof this._popover.togglePopover !== 'function') { this._addLog('warn', 'togglePopover 不可用'); return; }
    try {
      const result = this._popover.togglePopover();
      this._addLog('popover', `togglePopover() → ${result}（返回是否进入 open 态）`);
    } catch (err) {
      this._addLog('warn', `togglePopover 抛错：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. Popover API',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.popover ? 'success' : 'error' }, caps.popover ? 'Popover ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'show/hide/toggle + beforetoggle/toggle'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'element.popover = "auto" | "manual" | null 声明元素为弹层；element.showPopover() / hidePopover() / togglePopover() 命令式控制。auto 模式点击外部或 Esc 自动关闭、同时只允许一个打开；manual 模式需手动关闭。beforetoggle / toggle 事件携带 newState/oldState（"open"|"closed"）。声明式：button 元素加 popovertarget="id" + popovertargetaction="toggle|show|hide" 即可绑定。:popover-open 伪类匹配已打开的 popover。Popover 渲染在 Top Layer，不受父级 z-index/overflow 影响。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 Popover', { type: 'primary', size: 'sm', disabled: !caps.popover, onClick: () => this._createPopover() }),
          this._btn('showPopover', { type: 'primary', size: 'sm', disabled: !caps.popover, onClick: () => this._showPopover() }),
          this._btn('hidePopover', { size: 'sm', disabled: !caps.popover, onClick: () => this._hidePopover() }),
          this._btn('togglePopover', { type: 'primary', size: 'sm', disabled: !caps.popover, onClick: () => this._togglePopover() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Popover 状态与 toggle 事件流：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } },
          h('code', {}, s.popoverInfo || '（点击「创建 Popover」后，再 show/hide/toggle 观察 toggle 事件流）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`// 命令式
const pop = document.createElement('div');
pop.popover = 'auto';
document.body.appendChild(pop);
pop.addEventListener('toggle', (e) => console.log(e.oldState, '->', e.newState));
pop.showPopover(); pop.matches(':popover-open');   // true

<!-- 声明式 -->
<button popovertarget="my-pop" popovertargetaction="toggle">打开</button>
<div id="my-pop" popover="manual">内容</div>`)),
        h(Alert, {
          type: 'info',
          message: 'Popover 与 <dialog> 的区别',
          description: 'Popover 默认 light-dismiss（auto 模式点击外部关闭），适合菜单/提示/工具栏；<dialog>.showModal() 是显式模态（背景遮罩、焦点陷阱、需主动关闭）。两者都进入 Top Layer，互不遮蔽。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：<dialog> 元素 ===================

  // 创建 dialog 元素，监听 close / cancel 事件
  _createDialog() {
    const caps = this._caps();
    if (!caps.dialog) {
      this._addLog('warn', 'HTMLDialogElement 不可用：测试环境不支持，请用真实浏览器');
      this.setState({
        dialogInfo:
          `当前环境不支持 HTML <dialog> 元素（typeof HTMLDialogElement === "undefined"）。\n` +
          `请用现代浏览器打开本页。\n` +
          `本应演示：dialog.show() / showModal() / close(returnValue)；\n  dialog.returnValue / dialog.open；close / cancel 事件（Esc 触发）；\n  ::backdrop 伪元素 / Top Layer。`,
      });
      return;
    }
    try {
      if (this._dialog && this._dialog.parentNode) this._dialog.parentNode.removeChild(this._dialog);
      const dlg = document.createElement('dialog');
      dlg.textContent = '我是 <dialog> 元素，show() 非模态 / showModal() 模态（含遮罩）。';
      dlg.style.cssText = 'padding:16px;border:1px solid #5b9bf5;border-radius:8px;background:#fff;';
      // close 事件：dialog.close() 或 Esc 关闭后触发
      this._dialogCloseHandler = () => this._addLog('close', `dialog close 事件：returnValue="${dlg.returnValue}"，open=${dlg.open}`);
      // cancel 事件：showModal 时按 Esc 触发；preventDefault 可阻止关闭
      this._dialogCancelHandler = () => this._addLog('cancel', 'dialog cancel 事件（Esc 或 form method=dialog 触发）');
      dlg.addEventListener('close', this._dialogCloseHandler);
      dlg.addEventListener('cancel', this._dialogCancelHandler);
      document.body.appendChild(dlg);
      this._dialog = dlg;
      this._addLog('dialog', `已创建 dialog：已挂 close / cancel 监听，已 append 到 document.body`);
      this.setState({
        dialogInfo:
          `document.createElement('dialog') ✓（HTMLDialogElement），已 append 到 document.body（top layer 渲染）\n` +
          `已监听 close 事件（dialog.close() / Esc 后触发）与 cancel 事件（showModal 时 Esc 触发，可 preventDefault）\n\n` +
          `属性对照：\n` +
          `  dialog.open：boolean 是否打开；dialog.returnValue：close(returnValue) 传入的字符串\n  show()：非模态（不阻塞、无遮罩、无焦点陷阱）；showModal()：模态（::backdrop 遮罩、焦点陷阱、Esc 触发 cancel）\n  close([returnValue])：关闭并设置 returnValue`,
      });
    } catch (err) {
      this._addLog('warn', `创建 dialog 抛错：${err.name} - ${err.message}`);
    }
  }

  _showDialog() {
    if (!this._dialog) { this._addLog('warn', '请先点击「创建 dialog」'); return; }
    if (typeof this._dialog.show !== 'function') { this._addLog('warn', 'dialog.show 不可用'); return; }
    try {
      this._dialog.show();
      this._addLog('dialog', `dialog.show() 已调用（非模态，open=${this._dialog.open}）`);
      this.setState({ dialogInfo: (this.state.dialogInfo || '') + `\n\ndialog.show() ✓（非模态，open=${this._dialog.open}）` });
    } catch (err) {
      this._addLog('warn', `show 抛错：${err.name} - ${err.message}`);
    }
  }

  _showModalDialog() {
    if (!this._dialog) { this._addLog('warn', '请先点击「创建 dialog」'); return; }
    if (typeof this._dialog.showModal !== 'function') { this._addLog('warn', 'dialog.showModal 不可用'); return; }
    try {
      this._dialog.showModal();
      this._addLog('dialog', `dialog.showModal() 已调用（模态，::backdrop 生效，焦点陷阱开启）`);
      this.setState({ dialogInfo: (this.state.dialogInfo || '') + `\n\ndialog.showModal() ✓（模态，::backdrop 遮罩，焦点陷阱，Esc 触发 cancel）` });
    } catch (err) {
      this._addLog('warn', `showModal 抛错：${err.name} - ${err.message}`);
    }
  }

  _closeDialog() {
    if (!this._dialog) { this._addLog('warn', '请先点击「创建 dialog」'); return; }
    if (typeof this._dialog.close !== 'function') { this._addLog('warn', 'dialog.close 不可用'); return; }
    try {
      // close(returnValue)：传入字符串作为 returnValue，触发 close 事件
      const ret = `closed@${Date.now() % 100000}`;
      this._dialog.close(ret);
      this._addLog('dialog', `dialog.close("${ret}") 已调用（触发 close 事件，open=${this._dialog.open}）`);
      this.setState({ dialogInfo: (this.state.dialogInfo || '') + `\n\ndialog.close("${ret}") ✓\n  returnValue = "${this._dialog.returnValue}"\n  open = ${this._dialog.open}` });
    } catch (err) {
      this._addLog('warn', `close 抛错：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. HTML <dialog> 元素',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.dialog ? 'success' : 'error' }, caps.dialog ? '<dialog> ✓' : '不可用'),
        h(Tag, { color: caps.showModal ? 'primary' : 'warning' }, caps.showModal ? 'showModal ✓' : 'showModal ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.createElement("dialog") 创建原生对话框（HTMLDialogElement）。dialog.show() 非模态打开（不阻塞、无遮罩）；dialog.showModal() 模态打开（::backdrop 伪元素生成遮罩、焦点陷阱、Esc 触发 cancel 事件）；dialog.close(returnValue) 关闭并把 returnValue 存到 dialog.returnValue；dialog.open 反映当前打开态。close 事件在关闭后触发，cancel 事件在 showModal 时按 Esc 触发（preventDefault 可阻止关闭）。dialog 渲染在 Top Layer，不受父级 z-index/overflow 影响。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 dialog', { type: 'primary', size: 'sm', disabled: !caps.dialog, onClick: () => this._createDialog() }),
          this._btn('show()', { type: 'primary', size: 'sm', disabled: !caps.dialog, onClick: () => this._showDialog() }),
          this._btn('showModal()', { type: 'primary', size: 'sm', disabled: !caps.showModal, onClick: () => this._showModalDialog() }),
          this._btn('close()', { danger: true, size: 'sm', disabled: !caps.dialog, onClick: () => this._closeDialog() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'dialog 状态与事件流：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.dialogInfo || '（点击「创建 dialog」后，再 show / showModal / close 观察事件流）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const dlg = document.createElement('dialog');
dlg.innerHTML = '<p>确认删除？</p><form method="dialog"><button value="ok">确定</button></form>';
document.body.appendChild(dlg);
dlg.addEventListener('close', () => console.log('returnValue =', dlg.returnValue));
dlg.addEventListener('cancel', (e) => e.preventDefault());  // 禁用 Esc 关闭
dlg.showModal();            // 模态：::backdrop 遮罩 + 焦点陷阱
// form method="dialog" 提交即关闭，按钮 value 写入 returnValue
/* dialog::backdrop { background: rgba(0,0,0,.5); } */`)),
        h(Alert, {
          type: 'warning',
          message: 'showModal 必须挂载到 document 才生效',
          description: 'dialog.showModal() 要求元素已插入文档（appendChild 到 document.body）。多次调用 showModal/show 会抛 InvalidStateError。form method="dialog" 提交时按钮的 value 会写入 returnValue，无需 JS 干预。',
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
      h('h2', { class: 'section-title' }, 'WebGPU / View Transitions / Popover / <dialog> 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示四类现代 Web API：WebGPU（替代 WebGL 的现代图形 API）、View Transitions（DOM 间动画过渡）、Popover（声明式弹层）、HTML <dialog>（原生对话框）。所有 API 调用前做 typeof 能力检测，不可用时仅记日志说明，绝不抛异常。'),
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
