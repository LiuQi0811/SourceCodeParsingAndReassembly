// =====================================================================
// WebGPUStorageTexturePage.js —— WebGPU StorageTexture 与 Workgroup Storage 实验室
// 演示 WebGPU：
//   1. GPUTexture with STORAGE usage —— device.createTexture({ size, format, usage: GPUTextureUsage.STORAGE_BINDING | COPY_SRC | COPY_DST | TEXTURE_BINDING })，
//      storage texture 用于 compute shader 写入 / fragment shader 读写；format 限制（r32uint/r32sint/r32float/rgba8unorm/r16float 等，依 viewDimension 而定）。
//   2. writeTexture 与 copyExternalImageToTexture —— queue.writeTexture({ texture, mipLevel, origin }, dataBuffer, { bytesPerRow, rowsPerImage }, { width, height, depthOrArrayLayers })
//      写入纹理数据；queue.copyExternalImageToTexture({ source: imageBitmap/HTMLCanvasElement/OffscreenCanvas/HTMLVideoElement }, { texture, mipLevel, origin, flipY, premultipliedAlpha }, { width, height })
//      从图像源拷贝；GPUImageCopyTexture 与 GPUImageCopyExternalImage 结构对比。
//   3. storageTexture binding 与 bind group —— layout entry：{ binding, visibility: COMPUTE|FRAGMENT, storageTexture: { access: 'write-only'|'read-write'|'read-only', format, viewDimension } }；
//      WGSL：@group(0) @binding(0) var output: texture_storage_2d<r32uint, write>; / textureStore(output, coord, value) / textureLoad(output, coord)；
//      access: 'read-write' / 'read-only'（Chrome 113+），早期仅 'write-only'。
//   4. workgroupStorage 与 compute shader 共享内存 —— WGSL var<workgroup> shared: array<u32, 64>; 工作组内 invocations 共享；
//      workgroup_size(64) × workgroup_id × local_invocation_id；workgroupBarrier() 必须 control flow uniform；与 storageBarrier() 对比；
//      用途：reduce/scan/transpose 等并行算法，避免全局内存往返。
//   5. readStorageTexture / writeStorage 完整 pipeline —— input storage buffer → compute shader 读写 → output storage texture → copy to canvas；
//      pipeline layout、bind group、dispatch(workgroup_count_x, y, z)；read-write storage texture 验证 textureLoad→计算→textureStore；map-async 读回与错误处理。
//   6. 与 WebGL 对比与性能最佳实践 —— WebGL 无 storage texture（仅 texture + framebuffer），WebGPU 直接 bind 读写省 framebuffer blit；
//      storageTexture vs SSBO：textureLoad/Store 带 coord 的 2D/3D 结构化访问 vs 1D 线性 array indexing；
//      性能：workgroup storage 远快于 global storage（L1 cache）；storage texture 比 framebuffer+sampling 快（无 RT 开销）；
//      限制：storage texture format 受限、workgroup size 上限 256、workgroup memory 总量受限（16KB-32KB）。
// 说明：WebGPU 通过 navigator.gpu 访问，jsdom 中 navigator.gpu 不可用（typeof navigator.gpu === 'undefined'），
//       所有 GPU 资源（adapter/device/texture/buffer/pipeline/bindGroup）无法真实创建。本页所有按钮点击将通过展示 WGSL/JS 代码片段
//       与 API 表面说明演示概念，绝不抛异常。在真实浏览器（Chrome 113+，需 WebGPU 支持）中打开可完整执行 GPU 调用。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class WebGPUStorageTexturePage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      textureInfo: '',       // Card 1：GPUTexture with STORAGE usage
      writeInfo: '',         // Card 2：writeTexture 与 copyExternalImageToTexture
      bindingInfo: '',       // Card 3：storageTexture binding 与 bind group
      workgroupInfo: '',     // Card 4：workgroupStorage 与 compute shader 共享内存
      pipelineInfo: '',      // Card 5：readStorageTexture / writeStorage 完整 pipeline
      compareInfo: '',       // Card 6：与 WebGL 对比与性能最佳实践
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._adapter = null;             // GPUAdapter
    this._device = null;              // GPUDevice
    this._textures = [];              // 创建的 GPUTexture 引用
    this._buffers = [];               // 创建的 GPUBuffer 引用
    this._pipelines = [];             // 创建的 GPUComputePipeline 引用

    // 一次性能力检测：navigator.gpu + adapter/device 请求
    const caps = this._caps();
    const parts = [
      `navigator.gpu ${caps.gpu ? '✓' : '✗'}`,
      `requestAdapter ${caps.requestAdapter ? '✓' : '✗'}`,
      `GPUTextureUsage ${caps.textureUsage ? '✓' : '✗'}`,
      `GPUShaderStage ${caps.shaderStage ? '✓' : '✗'}`,
      `queue.writeTexture ${caps.writeTexture ? '✓' : '✗'}`,
      `copyExternalImageToTexture ${caps.copyExternalImage ? '✓' : '✗'}`,
    ];
    const anyAvailable = caps.gpu;
    const summary = anyAvailable
      ? `WebGPU 能力检测：${parts.join(' · ')}。jsdom 中 navigator.gpu 通常不可用，所有 GPU 资源（adapter/device/texture/buffer/pipeline/bindGroup）无法真实创建；按钮点击将以代码片段与 API 表面说明演示。`
      : '当前环境不支持 WebGPU（typeof navigator.gpu === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（Chrome 113+，需 WebGPU 支持）中打开可完整演示 GPU 调用。';

    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.gpu) this._addLog('warn', 'navigator.gpu 不可用（jsdom 无此属性，需 Chrome 113+ WebGPU 支持）');
    if (!caps.requestAdapter) this._addLog('warn', 'navigator.gpu.requestAdapter 不可用');
    if (!caps.writeTexture) this._addLog('warn', 'queue.writeTexture 不可用（需真实 GPU device）');
    if (!caps.copyExternalImage) this._addLog('warn', 'queue.copyExternalImageToTexture 不可用');
  }

  componentWillUnmount() {
    // 1. 释放创建的 GPUTexture（destroy）
    for (const t of this._textures || []) {
      try { if (t && typeof t.destroy === 'function') t.destroy(); } catch { /* noop */ }
    }
    this._textures = [];
    // 2. 释放创建的 GPUBuffer（destroy）
    for (const b of this._buffers || []) {
      try { if (b && typeof b.destroy === 'function') b.destroy(); } catch { /* noop */ }
    }
    this._buffers = [];
    // 3. 释放 GPUComputePipeline（无显式 destroy，释放引用即可）
    this._pipelines = [];
    // 4. destroy GPUDevice（释放逻辑设备及其资源）
    try {
      if (this._device && typeof this._device.destroy === 'function') this._device.destroy();
    } catch { /* noop */ }
    this._device = null;
    this._adapter = null;
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
    const hasNav = typeof navigator !== 'undefined';
    const gpu = hasNav ? navigator.gpu : null;
    const hasTexUsage = typeof GPUTextureUsage !== 'undefined';
    const hasShaderStage = typeof GPUShaderStage !== 'undefined';
    return {
      gpu: !!gpu,
      requestAdapter: !!(gpu && typeof gpu.requestAdapter === 'function'),
      textureUsage: hasTexUsage && !!GPUTextureUsage.STORAGE_BINDING,
      shaderStage: hasShaderStage && !!GPUShaderStage.COMPUTE,
      writeTexture: !!(gpu && typeof gpu.requestAdapter === 'function'), // 间接推断：真实 device 才有 queue.writeTexture
      copyExternalImage: !!(gpu && typeof gpu.requestAdapter === 'function'),
    };
  }

  // =================== Card 1：GPUTexture with STORAGE usage ===================

  _showTextureCaps() {
    const caps = this._caps();
    this.setState({ textureInfo:
      '===== WebGPU Storage Texture 能力检测 =====\n\n' +
      `  navigator.gpu            : ${caps.gpu ? 'object（可用）' : 'undefined（不可用）'}\n` +
      `  navigator.gpu.requestAdapter : ${caps.requestAdapter ? 'function（可用）' : 'undefined（不可用）'}\n` +
      `  GPUTextureUsage.STORAGE_BINDING : ${caps.textureUsage ? '可用' : 'undefined（不可用）'}\n` +
      `  GPUShaderStage.COMPUTE   : ${caps.shaderStage ? '可用' : 'undefined（不可用）'}\n\n` +
      'API 表面：navigator.gpu.requestAdapter({ powerPreference }) → Promise<GPUAdapter>；adapter.requestDevice() → Promise<GPUDevice>\n' +
      'device.createTexture({ size:[w,h,1], format, usage }) → GPUTexture；texture.createView({ dimension }) → GPUTextureView\n\n' +
      'STORAGE_BINDING usage 组合：STORAGE_BINDING | COPY_SRC | COPY_DST | TEXTURE_BINDING | RENDER_ATTACHMENT；storage texture 必须 STORAGE_BINDING。' });
    this._addLog('caps', `WebGPU 检测：gpu=${caps.gpu}, requestAdapter=${caps.requestAdapter}, STORAGE_BINDING=${caps.textureUsage}`);
  }

  _showCreateTextureOptions() {
    const caps = this._caps();
    if (!caps.gpu) {
      this.setState({ textureInfo:
        'device.createTexture 选项（不可用，仅说明）：\n\n' +
        "const texture = device.createTexture({\n" +
        "  size: [512, 512, 1],                    // [width, height, depthOrArrayLayers]\n" +
        "  format: 'r32uint',                       // storage texture 支持的格式\n" +
        "  usage: GPUTextureUsage.STORAGE_BINDING   // 必须，compute/fragment 读写\n" +
        "       | GPUTextureUsage.COPY_SRC          // copyExternalImageToTexture 写入后读出\n" +
        "       | GPUTextureUsage.COPY_DST          // writeTexture/copy 接收数据\n" +
        "       | GPUTextureUsage.TEXTURE_BINDING,  // fragment 采样（可选）\n" +
        "  dimension: '2d',                         // '1d'|'2d'|'3d'，默认 2d\n" +
        "  mipLevelCount: 1,                        // 默认 1\n" +
        "  sampleCount: 1,                          // storage 必须 1\n" +
        "  viewFormats: ['r32uint'],                // 兼容的 view format\n" +
        "});\n" +
        'const view = texture.createView({ dimension: "2d", format: "r32uint" });' });
      this._addLog('warn', 'navigator.gpu 不可用（jsdom 无），已记录 createTexture 用法');
      return;
    }
    this.setState({ textureInfo:
      'navigator.gpu 可用，真实创建请点击下方按钮调用 requestAdapter → requestDevice → createTexture。\n\n' +
      'createTexture 关键参数：size（[w,h,depthOrArrayLayers]）、format（storage 支持的格式）、usage（必须含 STORAGE_BINDING）、dimension、mipLevelCount、sampleCount（storage 必须 1）、viewFormats。\n\n' +
      'storage texture 用途：compute shader 写入（textureStore）/ fragment shader 读写（read-write，Chrome 113+）。' });
    this._addLog('texture', '已展示 createTexture 选项（navigator.gpu 可用）');
  }

  _explainUsageCombos() {
    this.setState({ textureInfo:
      '===== GPUTextureUsage 组合说明 =====\n\n' +
      'usage flag              | 含义                            | storage texture 是否需要\n' +
      '------------------------|---------------------------------|--------------------------\n' +
      'STORAGE_BINDING         | compute/fragment shader 读写    | ✓ 必须\n' +
      'COPY_SRC                | 作为 copy 源（copyTextureToTexture/copyTextureToBuffer）| 推荐（读回验证）\n' +
      'COPY_DST                | 作为 copy 目标（writeTexture/copy）| 推荐（写入数据）\n' +
      'TEXTURE_BINDING         | fragment 采样（sampler 配合）   | 可选（fragment read-only 时）\n' +
      'RENDER_ATTACHMENT       | 作为 render pass 颜色/深度附件   | 不兼容（storage 与 render 互斥）\n' +
      'RENDER_ATTACHMENT + STORAGE_BINDING | 不允许同时设置 | ✗ 运行时校验失败\n\n' +
      '典型组合：\n' +
      '  - compute 写入 + 读回验证：STORAGE_BINDING | COPY_SRC | COPY_DST\n' +
      '  - compute 写入 + fragment 采样：STORAGE_BINDING | TEXTURE_BINDING（早期仅 write-only，read-write 需 113+）\n' +
      '  - fragment read-write：STORAGE_BINDING | TEXTURE_BINDING（access="read-write"，Chrome 113+）' });
    this._addLog('usage', '已展示 STORAGE_BINDING usage 组合说明');
  }

  _explainFormatLimits() {
    this.setState({ textureInfo:
      '===== Storage Texture Format 限制 =====\n\n' +
      'format 必须是 storage-bindable format（GPUAdapter.features 与 format caps 共同决定）。常见可用格式：\n\n' +
      'format           | 通道 | 位宽  | viewDimension 支持            | 备注\n' +
      '-----------------|------|-------|-------------------------------|---------------------------\n' +
      'r32uint          | R    | 32    | 1d/2d/3d/2d-array/cube-array | 最常用，atomic 操作支持\n' +
      'r32sint          | R    | 32    | 同上                          | 有符号整数\n' +
      'r32float         | R    | 32    | 同上                          | 浮点（无 atomic）\n' +
      'rgba8unorm       | RGBA | 8x4   | 同上                          | 8-bit 归一化\n' +
      'rgba8snorm       | RGBA | 8x4   | 同上                          | 有符号归一化\n' +
      'rgba8uint        | RGBA | 8x4   | 同上                          | 原始 uint8\n' +
      'rgba8sint        | RGBA | 8x4   | 同上                          | 原始 sint8\n' +
      'rgba16uint       | RGBA | 16x4  | 同上                          | 16-bit\n' +
      'rgba16sint       | RGBA | 16x4  | 同上                          | 16-bit signed\n' +
      'rgba16float      | RGBA | 16x4  | 同上                          | 半精度浮点\n' +
      'r32uint + ...    | -    | -     | bgra8unorm 需 feature "bgra8unorm-storage"\n\n' +
      '限制：\n' +
      '  - storage texture 不支持 srgb 格式（rgba8unorm-srgb 不可，需用 rgba8unorm + 手动转换）\n' +
      '  - bc*/etc2*/astc* 压缩格式不支持 storage\n' +
      '  - depth/stencil 格式不支持 storage\n' +
      '  - viewDimension：1d 仅支持 1d 纹理；2d 支持 2d/2d-array/cube/cube-array；3d 支持 3d' });
    this._addLog('format', '已展示 storage texture format 限制（r32uint/r32sint/r32float/rgba8unorm/r16float 等）');
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. GPUTexture with STORAGE usage',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'navigator.gpu ✓' : 'navigator.gpu ✗'),
        h(Tag, { color: caps.textureUsage ? 'success' : 'error' }, caps.textureUsage ? 'STORAGE_BINDING ✓' : 'STORAGE_BINDING ✗'),
        h(Tag, { color: 'primary' }, 'storage texture')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.createTexture({ size, format, usage: GPUTextureUsage.STORAGE_BINDING | COPY_SRC | COPY_DST | TEXTURE_BINDING }) 创建 storage texture。storage texture 用于 compute shader 写入（textureStore）或 fragment shader 读写（access: read-write/read-only，Chrome 113+）。format 受限：r32uint/r32sint/r32float/rgba8unorm/rgba16float 等可 storage 绑定，srgb/压缩/depth 格式不可。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showTextureCaps() }),
          this._btn('createTexture 选项', { size: 'sm', onClick: () => this._showCreateTextureOptions() }),
          this._btn('usage 组合', { size: 'sm', onClick: () => this._explainUsageCombos() }),
          this._btn('format 限制', { size: 'sm', onClick: () => this._explainFormatLimits() })),
        h('div', { class: 'fs-sm text-secondary' }, 'Storage Texture 状态 / 用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.textureInfo || '（点击「能力检测」或「createTexture 选项」）')),
        h(Alert, { type: 'info', message: 'storage texture 是 storage binding 的纹理形式', description: '不同于 storage buffer 的 1D 线性访问，storage texture 通过 textureStore/textureLoad 以 2D/3D 坐标访问，适合图像处理（卷积、直方图、reduce）。需 STORAGE_BINDING usage，格式受限。Chrome 113+ 支持 read-write/read-only access。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：writeTexture 与 copyExternalImageToTexture ===================

  _showWriteTexture() {
    this.setState({ writeInfo:
      '===== queue.writeTexture 用法 =====\n\n' +
      'GPUImageCopyTexture 结构：{ texture, mipLevel?: 0, origin?: [x,y,z] = [0,0,0] }\n' +
      'GPUImageDataLayout 结构：{ offset?: 0, bytesPerRow, rowsPerImage? }\n' +
      'GPUExtent3D 结构：{ width, height?, depthOrArrayLayers? }\n\n' +
      '调用签名：\n' +
      '  queue.writeTexture(\n' +
      '    { texture, mipLevel: 0, origin: [0, 0, 0] },   // GPUImageCopyTexture\n' +
      '    dataBuffer,                                       // ArrayBuffer / TypedArray\n' +
      '    { offset: 0, bytesPerRow: 512*4, rowsPerImage: 512 }, // GPUImageDataLayout\n' +
      '    { width: 512, height: 512, depthOrArrayLayers: 1 }   // GPUExtent3D\n' +
      '  );\n\n' +
      'bytesPerRow 规则：必须 ≥ width × bytesPerPixel；必须为 256 的倍数（WebGPU 强制对齐）；不足需 padding。\n' +
      'rowsPerImage：默认 = height；array texture 时 = height × depthOrArrayLayers 的逻辑行数。\n\n' +
      '示例：写入 512×512 r32uint 纹理（每像素 4 字节）：\n' +
      '  const data = new Uint32Array(512 * 512);\n' +
      '  data.fill(0xff00ff00);\n' +
      '  queue.writeTexture({ texture, origin: [0,0,0] }, data, { bytesPerRow: 512*4, rowsPerImage: 512 }, { width: 512, height: 512 });' });
    this._addLog('write', '已展示 queue.writeTexture 用法（GPUImageCopyTexture + GPUImageDataLayout）');
  }

  _showCopyExternalImage() {
    this.setState({ writeInfo:
      '===== queue.copyExternalImageToTexture 用法 =====\n\n' +
      'GPUImageCopyExternalImage 结构（source）：\n' +
      '  { source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas | HTMLVideoElement, flipY?: false }\n\n' +
      'GPUImageCopyTextureTagged 结构（destination）：\n' +
      '  { texture, mipLevel?: 0, origin?: [0,0,0], flipY?: false, premultipliedAlpha?: false }\n\n' +
      'GPUExtent3D：{ width, height?, depthOrArrayLayers? }（depthOrArrayLayers 必须 1）\n\n' +
      '调用签名：\n' +
      '  queue.copyExternalImageToTexture(\n' +
      '    { source: imageBitmap, flipY: false },                         // source\n' +
      '    { texture, origin: [0,0,0], flipY: false, premultipliedAlpha: false }, // destination\n' +
      '    { width: 512, height: 512 }                                    // copy size\n' +
      '  );\n\n' +
      '图像源类型：\n' +
      '  - ImageBitmap：createImageBitmap(blob) 异步创建，跨域需 CORS\n' +
      '  - HTMLCanvasElement：2D canvas 内容（drawImage 后）\n' +
      '  - OffscreenCanvas：Worker 内可用（transferControlToOffscreen）\n' +
      '  - HTMLVideoElement：视频帧（currentTime 处帧）\n\n' +
      '注意：destination format 必须是 external image 兼容格式（rgba8unorm/bgra8unorm/rgba16float 等）；storage texture 通常不直接接收 external image，需先 copy 到 COPY_DST 纹理再 copyTextureToTexture。' });
    this._addLog('copy', '已展示 copyExternalImageToTexture 用法（ImageBitmap/Canvas/Video 源）');
  }

  _compareWriteMethods() {
    this.setState({ writeInfo:
      '===== writeTexture vs copyExternalImageToTexture 对比 =====\n\n' +
      '维度              | writeTexture                              | copyExternalImageToTexture\n' +
      '------------------|-------------------------------------------|--------------------------------------\n' +
      '数据源            | ArrayBuffer / TypedArray（CPU 内存）       | ImageBitmap/Canvas/Video（GPU 友好源）\n' +
      'destination       | GPUImageCopyTexture                       | GPUImageCopyTextureTagged（含 flipY/premultipliedAlpha）\n' +
      'layout 参数       | bytesPerRow + rowsPerImage（必须 256 对齐）| 无（按 source 像素布局）\n' +
      '色彩空间转换      | 无（直接字节）                             | 自动（sRGB → linear 等，按 tagged）\n' +
      'flipY             | 无（需手动翻转数据）                       | 支持（source.flipY / dest.flipY）\n' +
      'premultipliedAlpha| 无                                         | 支持（dest.premultipliedAlpha）\n' +
      '性能              | 小数据 / 结构化数据快                       | 图像源快（GPU 内部 copy，无 CPU 解码）\n' +
      '格式限制          | 任意 COPY_DST 格式                          | external-compatible 格式（rgba8unorm/bgra8unorm 等）\n' +
      '典型用例          | compute 计算结果写入 / 噪声数据             | 加载图片 / canvas / 视频帧到纹理\n\n' +
      'GPUImageCopyTexture vs GPUImageCopyExternalImage 结构对比：\n' +
      '  GPUImageCopyTexture        = { texture, mipLevel, origin }\n' +
      '  GPUImageCopyExternalImage  = { source, flipY }              // source 端\n' +
      '  GPUImageCopyTextureTagged  = { texture, mipLevel, origin, flipY, premultipliedAlpha }  // dest 端' });
    this._addLog('compare', '已对比 writeTexture vs copyExternalImageToTexture');
  }

  _explainImageSources() {
    this.setState({ writeInfo:
      '===== 图像源类型详解（copyExternalImageToTexture）=====\n\n' +
      '1. ImageBitmap：\n' +
      '   const bitmap = await createImageBitmap(blob, { imageOrientation: "flipY" });\n' +
      '   queue.copyExternalImageToTexture({ source: bitmap }, { texture }, { width: bitmap.width, height: bitmap.height });\n' +
      '   - 跨域需 CORS（fetch + blob）；transferable（Worker 间可转移）\n\n' +
      '2. HTMLCanvasElement：\n' +
      '   const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;\n' +
      '   const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);\n' +
      '   queue.copyExternalImageToTexture({ source: canvas }, { texture }, { width: 512, height: 512 });\n' +
      '   - 主线程专用；2D canvas 内容实时拷贝\n\n' +
      '3. OffscreenCanvas：\n' +
      '   const offscreen = new OffscreenCanvas(512, 512);\n' +
      '   const ctx = offscreen.getContext("2d"); /* draw */\n' +
      '   queue.copyExternalImageToTexture({ source: offscreen }, { texture }, { width: 512, height: 512 });\n' +
      '   - Worker 内可用（transferControlToOffscreen 从主线程转移）\n\n' +
      '4. HTMLVideoElement：\n' +
      '   const video = document.querySelector("video");\n' +
      '   queue.copyExternalImageToTexture({ source: video }, { texture }, { width: video.videoWidth, height: video.videoHeight });\n' +
      '   - 拷贝当前 currentTime 帧；需 video.readyState >= 2（HAVE_CURRENT_DATA）\n\n' +
      '限制：source 与 destination size 必须匹配（width/height 一致）；depthOrArrayLayers 必须 1；flipY 不能同时为 true（source 和 dest 不可都翻转）。' });
    this._addLog('source', '已展示 4 种图像源类型（ImageBitmap/Canvas/OffscreenCanvas/Video）');
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. writeTexture 与 copyExternalImageToTexture',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.writeTexture ? 'success' : 'error' }, caps.writeTexture ? 'writeTexture ✓' : 'writeTexture ✗'),
        h(Tag, { color: caps.copyExternalImage ? 'success' : 'error' }, caps.copyExternalImage ? 'copyExternal ✓' : 'copyExternal ✗'),
        h(Tag, { color: 'primary' }, 'GPUImageCopyTexture')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'queue.writeTexture({ texture, mipLevel, origin }, dataBuffer, { bytesPerRow, rowsPerImage }, { width, height, depthOrArrayLayers }) 写入纹理数据（TypedArray，bytesPerRow 需 256 对齐）。queue.copyExternalImageToTexture({ source: imageBitmap/HTMLCanvasElement/OffscreenCanvas/HTMLVideoElement }, { texture, origin, flipY, premultipliedAlpha }, { width, height }) 从图像源拷贝（自动色彩空间转换）。前者写结构化数据，后者写图像源。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('writeTexture', { type: 'primary', size: 'sm', onClick: () => this._showWriteTexture() }),
          this._btn('copyExternalImageToTexture', { size: 'sm', onClick: () => this._showCopyExternalImage() }),
          this._btn('write vs copy 对比', { size: 'sm', onClick: () => this._compareWriteMethods() }),
          this._btn('图像源类型', { size: 'sm', onClick: () => this._explainImageSources() })),
        h('div', { class: 'fs-sm text-secondary' }, '纹理写入状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.writeInfo || '（点击「writeTexture」或「copyExternalImageToTexture」）')),
        h(Alert, { type: 'info', message: '两种纹理写入路径分别面向结构化数据与图像源', description: 'writeTexture 适合 compute 计算结果（噪声、查找表）；copyExternalImageToTexture 适合加载图片/canvas/视频帧。前者需手动管理 bytesPerRow 对齐，后者自动处理色彩空间与 flipY。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：storageTexture binding 与 bind group ===================

  _showBindingLayout() {
    this.setState({ bindingInfo:
      '===== storageTexture BindGroupLayout Entry =====\n\n' +
      'layout entry 结构：\n' +
      '  {\n' +
      '    binding: 0,\n' +
      '    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,\n' +
      '    storageTexture: {\n' +
      '      access: "write-only",    // "write-only" | "read-write" | "read-only"\n' +
      '      format: "r32uint",        // 必须与 texture format 一致\n' +
      '      viewDimension: "2d",      // "1d"|"2d"|"2d-array"|"3d"|"cube"|"cube-array"\n' +
      '    },\n' +
      '  }\n\n' +
      '创建 layout + bind group：\n' +
      '  const layout = device.createBindGroupLayout({\n' +
      '    entries: [\n' +
      '      { binding: 0, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "r32uint", viewDimension: "2d" } },\n' +
      '    ],\n' +
      '  });\n' +
      '  const bindGroup = device.createBindGroup({\n' +
      '    layout,\n' +
      '    entries: [{ binding: 0, resource: texture.createView() }],\n' +
      '  });\n\n' +
      '注意：storageTexture entry 不可同时含 buffer/sampler/texture 字段；access 决定 shader 内 textureLoad/Store 可用性。' });
    this._addLog('binding', '已展示 storageTexture bind group layout entry');
  }

  _showWgslDeclaration() {
    this.setState({ bindingInfo:
      '===== WGSL storage texture 声明 =====\n\n' +
      '// write-only（所有版本支持）\n' +
      '@group(0) @binding(0) var output: texture_storage_2d<r32uint, write>;\n' +
      'textureStore(output, vec2<u32>(x, y), vec4<u32>(r, g, b, a));  // 写入\n' +
      '// textureLoad 不可用（write-only 不能读）\n\n' +
      '// read-write（Chrome 113+，需 feature "read-write-storage-texture"）\n' +
      '@group(0) @binding(0) var rw_tex: texture_storage_2d<r32uint, read_write>;\n' +
      'let v = textureLoad(rw_tex, vec2<u32>(x, y));  // 读取\n' +
      'textureStore(rw_tex, vec2<u32>(x, y), v * 2);  // 修改后写回\n\n' +
      '// read-only（Chrome 113+）\n' +
      '@group(0) @binding(0) var ro_tex: texture_storage_2d<r32uint, read>;\n' +
      'let v = textureLoad(ro_tex, vec2<u32>(x, y));\n' +
      '// textureStore 不可用（read-only 不能写）\n\n' +
      '// 不同 viewDimension 的 WGSL 类型：\n' +
      '//   2d          → texture_storage_2d<format, access>\n' +
      '//   2d-array    → texture_storage_2d_array<format, access>\n' +
      '//   3d          → texture_storage_3d<format, access>\n' +
      '//   1d          → texture_storage_1d<format, access>\n\n' +
      'WGSL format 映射：rgba8unorm/rgba8snorm/rgba8uint/rgba8sint/r32uint/r32sint/r32float/rgba16uint/rgba16sint/rgba16float 等。\n' +
      'textureStore 签名：textureStore(t: texture_storage_*<F,write>, coords: vecN<u32>, value: vec4<...>) → void' });
    this._addLog('wgsl', '已展示 WGSL storage texture 声明（write/read_write/read + textureStore/Load）');
  }

  _explainAccessModes() {
    this.setState({ bindingInfo:
      '===== storageTexture access 模式 =====\n\n' +
      'access       | 引入版本       | textureLoad | textureStore | 典型用例\n' +
      '-------------|----------------|-------------|--------------|---------------------------\n' +
      'write-only   | WebGPU v1      | ✗           | ✓            | compute 写入输出图像\n' +
      'read-write   | Chrome 113+    | ✓           | ✓            | 错位读写（卷积、迭代算法）\n' +
      'read-only    | Chrome 113+    | ✓           | ✗            | fragment 着色器读取 compute 结果\n\n' +
      'Chrome 113+ 启用 "read-write-storage-texture" feature：\n' +
      '  - device.features.has("read-write-storage-texture") 检测\n' +
      '  - adapter.requestDevice({ requiredFeatures: ["read-write-storage-texture"] }) 请求\n\n' +
      '早期（v1）仅 write-only，需 read-write 时只能：\n' +
      '  1) write-only storage texture ← compute shader 写\n' +
      '  2) copyTextureToBuffer → mapAsync → CPU 处理 → writeTexture 到另一 texture\n  3) 或用 storage buffer 替代（线性访问）\n\n' +
      'read-write 优势：单 pass 完成卷积 / histogram equalization / 迭代解 PDE，无需 ping-pong 两张纹理。' });
    this._addLog('access', '已展示 storage texture access 模式（write-only/read-write/read-only）');
  }

  _explainViewDimension() {
    this.setState({ bindingInfo:
      '===== storageTexture viewDimension 说明 =====\n\n' +
      'viewDimension 决定 WGSL texture_storage_* 类型与 textureStore/Load 的坐标维度：\n\n' +
      'viewDimension | WGSL 类型                       | textureStore coord | 适用纹理\n' +
      '--------------|---------------------------------|--------------------|--------------------------\n' +
      '1d            | texture_storage_1d<F,A>         | u32                | 1d texture（width,1,1）\n' +
      '2d            | texture_storage_2d<F,A>         | vec2<u32>          | 2d texture（width,height,1）\n' +
      '2d-array      | texture_storage_2d_array<F,A>   | vec3<u32>(x,y,layer) | 2d array texture\n' +
      '3d            | texture_storage_3d<F,A>         | vec3<u32>          | 3d texture（width,height,depth）\n' +
      'cube          | 不支持 storage                  | -                  | cubemap（无 storage binding）\n' +
      'cube-array    | 不支持 storage                  | -                  | cubemap array（无 storage）\n\n' +
      '限制：\n' +
      '  - cube / cube-array 不支持 storage binding（仅 TEXTURE_BINDING 采样）\n' +
      '  - 2d-array 与 3d 需 texture 创建时 dimension 匹配（2d-array 需 array layer count > 1）\n' +
      '  - texture.createView({ dimension }) 的 dimension 必须与 layout entry 的 viewDimension 一致\n\n' +
      '示例：3d storage texture 用于体素数据：\n' +
      '  const tex = device.createTexture({ size: [64,64,64], format: "r32uint", usage: STORAGE_BINDING });\n' +
      '  layout entry: { storageTexture: { access: "write-only", format: "r32uint", viewDimension: "3d" } }\n' +
      '  WGSL: @group(0) @binding(0) var voxels: texture_storage_3d<r32uint, write>;\n' +
      '  textureStore(voxels, vec3<u32>(x,y,z), value);' });
    this._addLog('view', '已展示 storage texture viewDimension（1d/2d/2d-array/3d，cube 不支持）');
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. storageTexture binding 与 bind group',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.shaderStage ? 'success' : 'error' }, caps.shaderStage ? 'GPUShaderStage ✓' : 'GPUShaderStage ✗'),
        h(Tag, { color: 'primary' }, 'access: write-only | read-write | read-only'),
        h(Tag, { color: 'warning' }, 'texture_storage_2d')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'BindGroupLayout entry：{ binding, visibility: COMPUTE|FRAGMENT, storageTexture: { access: "write-only"|"read-write"|"read-only", format, viewDimension } }。WGSL：@group(0) @binding(0) var output: texture_storage_2d<r32uint, write>; + textureStore(output, coord, value) / textureLoad(output, coord)。access: read-write/read-only 需 Chrome 113+（feature "read-write-storage-texture"），早期仅 write-only。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('binding layout', { type: 'primary', size: 'sm', onClick: () => this._showBindingLayout() }),
          this._btn('WGSL 声明', { size: 'sm', onClick: () => this._showWgslDeclaration() }),
          this._btn('access 模式', { size: 'sm', onClick: () => this._explainAccessModes() }),
          this._btn('viewDimension', { size: 'sm', onClick: () => this._explainViewDimension() })),
        h('div', { class: 'fs-sm text-secondary' }, 'storageTexture binding 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.bindingInfo || '（点击「binding layout」或「WGSL 声明」）')),
        h(Alert, { type: 'info', message: 'storageTexture entry 不同于 texture entry：直接读写而非采样', description: 'texture entry 配合 sampler 走采样管线（filtering）；storageTexture entry 走 load/store 直接访问像素，无 filtering，无 mipmap 自动选择，坐标为整数 u32。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：workgroupStorage 与 compute shader 共享内存 ===================

  _showWorkgroupDeclaration() {
    this.setState({ workgroupInfo:
      '===== var<workgroup> 共享内存声明 =====\n\n' +
      'WGSL 语法：var<workgroup> name: type;\n\n' +
      '示例：\n' +
      '  @group(0) @binding(0) var<storage, read> input: array<u32>;\n' +
      '  @group(0) @binding(1) var<storage, read_write> output: array<u32>;\n' +
      '  var<workgroup> shared: array<u32, 64>;  // 64 个 u32（256 字节），工作组内共享\n\n' +
      'workgroup 内存语义：\n' +
      '  - 同一 workgroup 内所有 invocations 共享（跨 workgroup 不共享）\n' +
      '  - workgroup_size(N) 决定 invocations 数（N 个线程共享这块内存）\n' +
      '  - 初始值未定义，必须显式写入后才能读\n' +
      '  - 地址空间：workgroup（与 function/private/storage 区分）\n\n' +
      '完整 compute shader 示例：\n' +
      '  @compute @workgroup_size(64)\n' +
      '  fn main(@builtin(workgroup_id) wg: vec3<u32>,\n' +
      '          @builtin(local_invocation_id) local: vec3<u32>,\n' +
      '          @builtin(global_invocation_id) global: vec3<u32>) {\n' +
      '    let gid = global.x;\n' +
      '    shared[local.x] = input[gid];            // 各 invocation 加载数据到 shared\n' +
      '    workgroupBarrier();                       // 同步：所有 invocation 完成写入\n' +
      '    // 此时所有 shared[] 可读\n' +
      '    output[gid] = shared[(local.x + 1) % 64]; // 读邻居数据\n' +
      '  }' });
    this._addLog('workgroup', '已展示 var<workgroup> 声明与 compute shader 示例');
  }

  _showWorkgroupBarrier() {
    this.setState({ workgroupInfo:
      '===== workgroupBarrier 与 storageBarrier 对比 =====\n\n' +
      'workgroupBarrier():\n' +
      '  - 同步同一 workgroup 内所有 invocations 的执行 + workgroup 内存可见性\n' +
      '  - 必须在 control flow uniform 位置调用（所有 invocation 走相同路径）\n' +
      '  - 不可在 if 分支内（除非分支条件对所有 invocation 相同）\n' +
      '  - 不可在循环内（除非循环次数对所有 invocation 相同）\n\n' +
      'storageBarrier():\n' +
      '  - 同步 storage buffer 内存可见性（不保证执行顺序）\n' +
      '  - 用于 ensure 某 invocation 写入的 storage 数据对其他 invocation 可见\n' +
      '  - 同样需 control flow uniform\n\n' +
      '对比表：\n' +
      'barrier           | 同步执行 | workgroup 内存可见 | storage 内存可见\n' +
      '------------------|----------|--------------------|------------------\n' +
      'workgroupBarrier()| ✓        | ✓                  | ✓\n' +
      'storageBarrier()  | ✗        | ✗                  | ✓\n' +
      'atomicStore/Load  | ✗        | ✗                  | ✓（原子操作自带可见性）\n\n' +
      '错误示例（control flow non-uniform，运行时校验失败）：\n' +
      '  if (local.x < 32) { workgroupBarrier(); }  // ✗ 仅前 32 个 invocation 调用\n\n' +
      '正确示例：\n' +
      '  workgroupBarrier();                          // ✓ 所有 invocation 都调用\n' +
      '  if (local.x < 32) { /* 处理 */ }' });
    this._addLog('barrier', '已展示 workgroupBarrier vs storageBarrier（control flow uniform 约束）');
  }

  _explainWorkgroupSizeTuning() {
    this.setState({ workgroupInfo:
      '===== workgroup_size 调优 =====\n\n' +
      'WGSL 声明：@workgroup_size(x, y, z) 或 @workgroup_size(x)（y=z=1）\n' +
      '  - x*y*z ≤ 256（WebGPU 强制上限，部分设备支持 1024 需 feature）\n' +
      '  - x*y*z 即 workgroup 内 invocation 数（线程数）\n\n' +
      'dispatch：passEncoder.dispatchWorkgroups(workgroup_count_x, workgroup_count_y, workgroup_count_z)\n' +
      '  - 总 invocation 数 = (x*y*z) * (workgroup_count_x * workgroup_count_y * workgroup_count_z)\n\n' +
      '调优原则：\n' +
      '  1) workgroup_size 应为 wave/warp 大小倍数（NVIDIA 32，AMD 64），避免占用率下降\n' +
      '  2) workgroup 内存复用：大 workgroup_size 减少 dispatch 次数，但增加 shared 内存占用\n' +
      '  3) shared 内存总量受限（16KB-32KB / workgroup），超限编译失败\n' +
      '  4) 计算 shared 占用：array<u32, N> = N*4 字节；array<f32, 1024> = 4KB\n' +
      '  5) 2D/3D workgroup_size 对应纹理维度（@workgroup_size(8,8) 处理 8×8 像素块）\n\n' +
      '示例：512×512 纹理，@workgroup_size(8,8)：\n' +
      '  dispatchWorkgroups(64, 64);  // 64*8=512, 64*8=512\n' +
      '  总 invocation = 8*8 * 64*64 = 262144 = 512*512（每个像素一个 invocation）\n' +
      '  shared 内存：array<f32, 64> = 256 字节/workgroup' });
    this._addLog('tuning', '已展示 workgroup_size 调优（≤256、wave 倍数、shared 内存预算）');
  }

  _explainReduceAlgorithm() {
    this.setState({ workgroupInfo:
      '===== Workgroup Reduce 算法示例（并行求和）=====\n\n' +
      '问题：N 个数求和，N=1024，workgroup_size=64，每个 invocation 处理 16 个数\n\n' +
      'WGSL 实现：\n' +
      '  var<workgroup> shared: array<u32, 64>;\n' +
      '\n' +
      '  @compute @workgroup_size(64)\n' +
      '  fn reduce(@builtin(local_invocation_id) local: vec3<u32>,\n' +
      '            @builtin(workgroup_id) wg: vec3<u32>) {\n' +
      '    let base = wg.x * 64 * 16 + local.x * 16;\n' +
      '    var sum: u32 = 0u;\n' +
      '    for (var i: u32 = 0u; i < 16u; i = i + 1u) {\n' +
      '      sum = sum + input[base + i];\n' +
      '    }\n' +
      '    shared[local.x] = sum;          // 每个 invocation 写入部分和\n' +
      '    workgroupBarrier();              // 同步：所有部分和就位\n' +
      '\n' +
      '    // 树形规约：log2(64)=6 轮\n' +
      '    for (var stride: u32 = 32u; stride > 0u; stride = stride >> 1u) {\n' +
      '      if (local.x < stride) {\n' +
      '        shared[local.x] = shared[local.x] + shared[local.x + stride];\n' +
      '      }\n' +
      '      workgroupBarrier();            // 每轮同步\n' +
      '    }\n' +
      '\n' +
      '    if (local.x == 0u) {\n' +
      '      output[wg.x] = shared[0];      // 每个 workgroup 输出一个和\n' +
      '    }\n' +
      '  }\n\n' +
      '优势：\n' +
      '  - 单 pass 内完成 workgroup 内规约（6 轮 barrier vs 64 轮串行）\n' +
      '  - shared 内存访问远快于 storage buffer（L1 cache）\n' +
      '  - 全局规约需第二 pass：将各 workgroup 输出（64 个和）再 reduce 一次\n\n' +
      '类似算法：prefix sum（scan）/ transpose / histogram / bitonic sort。' });
    this._addLog('reduce', '已展示 workgroup reduce 算法（树形规约 + workgroupBarrier）');
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. workgroupStorage 与 compute shader 共享内存',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.shaderStage ? 'success' : 'error' }, caps.shaderStage ? 'COMPUTE ✓' : 'COMPUTE ✗'),
        h(Tag, { color: 'primary' }, 'var<workgroup>'),
        h(Tag, { color: 'warning' }, 'workgroupBarrier')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'WGSL var<workgroup> shared: array<u32, 64>; 声明工作组内共享内存，同一 workgroup 的 invocations 互可见（跨 workgroup 不共享）。workgroup_size(64) × workgroup_id × local_invocation_id 决定 invocation 坐标。workgroupBarrier() 同步执行 + workgroup/storage 内存可见性，必须在 control flow uniform 位置调用。用途：reduce/scan/transpose 等并行算法，避免全局内存往返，远快于 storage buffer。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('workgroup 声明', { type: 'primary', size: 'sm', onClick: () => this._showWorkgroupDeclaration() }),
          this._btn('workgroupBarrier', { size: 'sm', onClick: () => this._showWorkgroupBarrier() }),
          this._btn('workgroup_size 调优', { size: 'sm', onClick: () => this._explainWorkgroupSizeTuning() }),
          this._btn('reduce 算法示例', { size: 'sm', onClick: () => this._explainReduceAlgorithm() })),
        h('div', { class: 'fs-sm text-secondary' }, 'workgroup storage 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.workgroupInfo || '（点击「workgroup 声明」或「workgroupBarrier」）')),
        h(Alert, { type: 'info', message: 'workgroup storage 是 compute shader 的高速共享内存', description: '不同于 storage buffer 的全局内存访问，workgroup 内存位于 L1 cache，延迟低、带宽高，适合 reduce/scan 等需要线程间数据交换的算法。workgroupBarrier 保证可见性，但需 control flow uniform。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：readStorageTexture / writeStorage 完整 pipeline ===================

  _showFullPipeline() {
    this.setState({ pipelineInfo:
      '===== 完整 compute pipeline（input buffer → compute → output texture → canvas）=====\n\n' +
      '1) 创建资源：\n' +
      '  const inputBuffer = device.createBuffer({ size: 512*512*4, usage: STORAGE | COPY_DST });\n' +
      '  queue.writeBuffer(inputBuffer, 0, inputData);  // 写入计算数据\n' +
      '  const outputTex = device.createTexture({\n' +
      '    size: [512,512,1], format: "rgba8unorm",\n' +
      '    usage: STORAGE_BINDING | COPY_SRC | RENDER_ATTACHMENT,  // 后续渲染到 canvas\n' +
      '  });\n' +
      '  const outputView = outputTex.createView();\n\n' +
      '2) pipeline layout + bind group：\n' +
      '  const layout = device.createBindGroupLayout({\n' +
      '    entries: [\n' +
      '      { binding: 0, visibility: COMPUTE, buffer: { type: "read-only-storage" } },\n' +
      '      { binding: 1, visibility: COMPUTE, storageTexture: { access: "write-only", format: "rgba8unorm", viewDimension: "2d" } },\n' +
      '    ],\n' +
      '  });\n' +
      '  const pipeline = device.createComputePipeline({\n' +
      '    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),\n' +
      '    compute: { module: shaderModule, entryPoint: "main" },\n' +
      '  });\n' +
      '  const bindGroup = device.createBindGroup({\n' +
      '    layout,\n' +
      '    entries: [{ binding: 0, resource: { buffer: inputBuffer } }, { binding: 1, resource: outputView }],\n' +
      '  });\n\n' +
      '3) dispatch：\n' +
      '  const encoder = device.createCommandEncoder();\n' +
      '  const pass = encoder.beginComputePass();\n' +
      '  pass.setPipeline(pipeline);\n' +
      '  pass.setBindGroup(0, bindGroup);\n' +
      '  pass.dispatchWorkgroups(64, 64);  // 512/8 × 512/8（@workgroup_size(8,8)）\n' +
      '  pass.end();\n' +
      '  queue.submit([encoder.finish()]);\n\n' +
      '4) copy to canvas（render pass 或 copyTextureToTexture）：\n' +
      '  // 方法 A：render pass 采样 outputTex 到 canvas texture\n' +
      '  // 方法 B：copyExternalImageToTexture 反向（WebGPU 不直接支持 texture→canvas，需 render pass）\n' +
      '  // 方法 C：copyTextureToBuffer → mapAsync → putImageData' });
    this._addLog('pipeline', '已展示完整 compute pipeline（buffer→compute→texture→canvas）');
  }

  _explainDispatchDimensions() {
    this.setState({ pipelineInfo:
      '===== dispatch 维度说明 =====\n\n' +
      'dispatchWorkgroups(workgroup_count_x, workgroup_count_y, workgroup_count_z)\n\n' +
      '总 invocation 数 = (wg_size_x * wg_size_y * wg_size_z) * (count_x * count_y * count_z)\n\n' +
      'global_invocation_id 计算：\n' +
      '  global = workgroup_id * workgroup_size + local_invocation_id\n' +
      '  global.x ∈ [0, count_x * wg_size_x)\n' +
      '  global.y ∈ [0, count_y * wg_size_y)\n' +
      '  global.z ∈ [0, count_z * wg_size_z)\n\n' +
      '示例：处理 512×512 纹理（每个像素一个 invocation）：\n' +
      '  方案 A：@workgroup_size(8,8) + dispatchWorkgroups(64,64)\n' +
      '    总 invocation = 64 * 64*64*64 = 262144 = 512*512\n' +
      '  方案 B：@workgroup_size(16,16) + dispatchWorkgroups(32,32)\n' +
      '    总 invocation = 256 * 32*32 = 262144（workgroup 更大，dispatch 更少）\n' +
      '  方案 C：@workgroup_size(1) + dispatchWorkgroups(262144)  // 1D 形式，性能差\n\n' +
      '选择原则：\n' +
      '  - workgroup_size 尽量为 wave 倍数（32/64），且 ×count 后覆盖整个问题域\n' +
      '  - 边界处理：global_invocation_id 超出纹理尺寸时 early return\n' +
      '  - 3D dispatch 用于 3d texture / 体素数据：dispatchWorkgroups(x,y,z)\n\n' +
      'WGSL 内置 builtin：\n' +
      '  @builtin(workgroup_id) wg: vec3<u32>          // dispatch 的网格坐标\n' +
      '  @builtin(local_invocation_id) local: vec3<u32> // workgroup 内坐标\n' +
      '  @builtin(global_invocation_id) global: vec3<u32>// 全局坐标\n' +
      '  @builtin(num_workgroups) num: vec3<u32>        // dispatch 的 count（运行时）' });
    this._addLog('dispatch', '已展示 dispatch 维度计算（workgroup_size × count = 总 invocation）');
  }

  _explainMapAsyncReadback() {
    this.setState({ pipelineInfo:
      '===== mapAsync 读回 storage texture 数据 =====\n\n' +
      'storage texture 无直接 mapAsync（只有 buffer 可 map）。读回需：\n' +
      '  1) 创建 staging buffer（MAP_READ | COPY_DST）\n' +
      '  2) copyTextureToBuffer：将 texture 数据拷贝到 buffer\n' +
      '  3) mapAsync + getMappedRange 读取\n\n' +
      '代码示例：\n' +
      '  const stagingBuf = device.createBuffer({\n' +
      '    size: 512 * 512 * 4,  // bytesPerRow 必须 256 对齐，可能需 padding\n' +
      '    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,\n' +
      '  });\n' +
      '  const encoder = device.createCommandEncoder();\n' +
      '  encoder.copyTextureToBuffer(\n' +
      '    { texture: outputTex, mipLevel: 0, origin: [0,0,0] },\n' +
      '    { buffer: stagingBuf, offset: 0, bytesPerRow: 512*4, rowsPerImage: 512 },\n' +
      '    { width: 512, height: 512 },\n' +
      '  );\n' +
      '  queue.submit([encoder.finish()]);\n' +
      '\n' +
      '  await stagingBuf.mapAsync(GPUMapMode.READ);\n' +
      '  const data = new Uint8Array(stagingBuf.getMappedRange());\n' +
      '  // 处理 data...\n' +
      '  stagingBuf.unmap();\n' +
      '  stagingBuf.destroy();\n\n' +
      'bytesPerRow 规则：必须 ≥ width * bytesPerPixel，且 256 对齐；不满足需 padding（实际 size 按 aligned bytesPerRow * height）。\n\n' +
      '替代方案：copyExternalImageToTexture 反向不可用（WebGPU 无 textureToExternalImage）；render pass 到 canvas texture 后 canvas.readPixels / ImageBitmap。' });
    this._addLog('readback', '已展示 mapAsync 读回（copyTextureToBuffer + staging buffer）');
  }

  _explainErrorHandling() {
    this.setState({ pipelineInfo:
      '===== WebGPU 错误处理 =====\n\n' +
      '1) device.pushErrorScope / popErrorScope（异步捕获）：\n' +
      '  device.pushErrorScope("validation");\n' +
      '  // ... 危险操作（createTexture/pipeline/bindGroup）...\n' +
      '  const err = await device.popErrorScope();\n' +
      '  if (err) console.error(err.message);  // GPUValidationError\n\n' +
      '2) device.addEventListener("uncapturederror", e => e.error)：\n' +
      '  device.addEventListener("uncapturederror", (event) => {\n' +
      '    console.error("Uncaptured GPU error:", event.error.message);\n' +
      '    // event.error: GPUValidationError | GPUOutOfMemoryError | GPUInternalError\n' +
      '  });\n\n' +
      '3) 常见 validation 错误：\n' +
      '  - storage texture format 不支持（如 srgb / depth）\n' +
      '  - usage 缺少 STORAGE_BINDING\n' +
      '  - access "read-write" 但 device.features 无 "read-write-storage-texture"\n' +
      '  - workgroup_size 超过 256（无 feature 时）\n' +
      '  - shared 内存超限（16KB-32KB / workgroup）\n' +
      '  - workgroupBarrier 在 non-uniform control flow\n' +
      '  - bytesPerRow 非 256 对齐\n' +
      '  - bind group resource 与 layout 类型不匹配\n\n' +
      '4) device.lost（设备丢失，不可恢复）：\n' +
      '  device.lost.then((info) => {\n' +
      '    console.error("Device lost:", info.reason, info.message);\n' +
      '    // reason: "destroyed" | "unknown" —— 需重新 requestAdapter + requestDevice\n' +
      '  });\n\n' +
      '5) read-write storage texture 验证模式（错位读写）：\n' +
      '  // compute shader：textureLoad 读 → 计算 → textureStore 写回同一 texture\n' +
      '  // 需 access: "read-write"，且 dispatch 内无 race（每个 coord 只一个 invocation 读写）\n' +
      '  // 注意：read-write 不保证原子性，需 atomicXXX 函数（仅 r32uint/r32sint 支持 atomic）' });
    this._addLog('error', '已展示 WebGPU 错误处理（errorScope / uncapturederror / device.lost）');
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. readStorageTexture / writeStorage 完整 pipeline',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gpu ? 'success' : 'error' }, caps.gpu ? 'pipeline ✓' : 'pipeline ✗'),
        h(Tag, { color: 'primary' }, 'dispatch + mapAsync'),
        h(Tag, { color: 'warning' }, 'read-write 验证')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '完整 compute pipeline：input storage buffer → compute shader 读写 → output storage texture → copy to canvas。pipeline layout（bindGroupLayouts）+ bindGroup + dispatchWorkgroups(x,y,z)。错位 read-write storage texture 验证：textureLoad 读取 → 计算 → textureStore 写回（需 access: "read-write"，Chrome 113+）。读回用 copyTextureToBuffer + staging buffer + mapAsync。错误处理：pushErrorScope / uncapturederror / device.lost。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('完整 pipeline', { type: 'primary', size: 'sm', onClick: () => this._showFullPipeline() }),
          this._btn('dispatch 维度', { size: 'sm', onClick: () => this._explainDispatchDimensions() }),
          this._btn('mapAsync 读回', { size: 'sm', onClick: () => this._explainMapAsyncReadback() }),
          this._btn('错误处理', { size: 'sm', onClick: () => this._explainErrorHandling() })),
        h('div', { class: 'fs-sm text-secondary' }, 'compute pipeline 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.pipelineInfo || '（点击「完整 pipeline」或「dispatch 维度」）')),
        h(Alert, { type: 'info', message: 'storage texture 是 compute → fragment / canvas 的桥梁', description: 'compute shader 写入 storage texture，fragment shader 采样（或 render pass）渲染到 canvas，省去 CPU 读回 + reupload。read-write access 让单 pass 完成迭代算法（卷积、PDE 解）。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：与 WebGL 对比与性能最佳实践 ===================

  _compareWebGL() {
    this.setState({ compareInfo:
      '===== WebGL vs WebGPU（storage texture 维度）=====\n\n' +
      '维度              | WebGL                          | WebGPU\n' +
      '------------------|--------------------------------|--------------------------------------\n' +
      'storage texture   | 无（仅 texture + framebuffer） | GPUTextureUsage.STORAGE_BINDING\n' +
      '写入纹理          | framebuffer 渲染（glTexImage2D / FBO blit）| textureStore / writeTexture\n' +
      'compute shader    | 无（用 fragment shader 模拟）  | @compute + dispatchWorkgroups\n' +
      '读回              | glReadPixels（同步，阻塞）     | copyTextureToBuffer + mapAsync（异步）\n' +
      'workgroup 共享    | 无（fragment shader 无共享）   | var<workgroup> + workgroupBarrier\n' +
      '图像源拷贝        | texImage2D(canvas/video)      | copyExternalImageToTexture\n' +
      '格式限制          | 较宽（含 srgb）                | storage 受限（无 srgb/depth/压缩）\n\n' +
      'WebGL 写入纹理流程：\n' +
      '  1) gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)\n' +
      '  2) gl.framebufferTexture2D(... texture ...)\n' +
      '  3) fragment shader 渲染 → 写入 texture\n' +
      '  4) 如需采样：unbind fbo → bind texture → 渲染\n  5) 多 pass：blit / ping-pong 两张 texture\n\n' +
      'WebGPU 写入 storage texture 流程：\n' +
      '  1) createTexture({ usage: STORAGE_BINDING })\n' +
      '  2) bind group 绑定 storageTexture\n' +
      '  3) compute shader textureStore 直接写入\n' +
      '  4) 如需采样：bind 到 fragment 的 TEXTURE_BINDING（同张纹理可双用）\n  5) read-write：单 pass 完成\n\n' +
      '结论：WebGPU 省去 framebuffer blit，compute 直接写 texture；read-write access 省去 ping-pong。' });
    this._addLog('webgl', '已对比 WebGL vs WebGPU storage texture（省 framebuffer blit）');
  }

  _compareSSBO() {
    this.setState({ compareInfo:
      '===== storageTexture vs SSBO（storage buffer）对比 =====\n\n' +
      '维度          | storageTexture                          | SSBO (storage buffer)\n' +
      '--------------|-----------------------------------------|--------------------------------------\n' +
      '访问维度      | 2D/3D 坐标（textureLoad/Store + coord） | 1D 线性（array[index]）\n' +
      'WGSL 类型     | texture_storage_2d<format, access>      | var<storage, read_write> array<T>\n' +
      '坐标类型      | vecN<u32>（整数像素坐标）              | u32 index\n' +
      '数据类型      | 固定格式（r32uint/rgba8unorm 等）       | 任意 T（u32/f32/struct/array）\n' +
      'filtering     | 无（直接像素读写）                      | 无\n' +
      'mipmap        | 不自动（需手动选 level）                | 无\n' +
      '边界处理      | 超坐标 UB（未定义）                     | 越界 UB / 返回 0\n' +
      'atomic 操作   | 仅 r32uint/r32sint                      | atomicAdd/Load/Store on i32/u32\n' +
      '内存布局      | 按纹理格式（row-major, padded）         | 紧凑 struct array\n' +
      '典型用例      | 图像处理（卷积/histogram/reduce 2D）   | 数据并行（粒子/物理/大数组计算）\n\n' +
      '选择原则：\n' +
      '  - 数据本质是 2D/3D 图像 → storageTexture（坐标自然，避免手算 index）\n' +
      '  - 数据本质是 1D 数组 / 结构体 → SSBO（类型灵活，紧凑布局）\n' +
      '  - 需原子操作 → 两者都支持（r32uint / u32），但 SSBO 更通用\n' +
      '  - 跨 shader stage 共享 → SSBO 更灵活（vertex/fragment 都能用）\n' +
      '  - 与 render pass 集成 → storageTexture（fragment 可直接采样）' });
    this._addLog('ssbo', '已对比 storageTexture vs SSBO（2D 坐标 vs 1D 索引）');
  }

  _showPerformanceData() {
    this.setState({ compareInfo:
      '===== Workgroup Storage 与 Storage Texture 性能数据 =====\n\n' +
      '1) Workgroup storage vs global storage（storage buffer）：\n' +
      '  - workgroup 内存：L1 cache，延迟 ~10-30 cycles，带宽 ~TB/s\n' +
      '  - global storage（VRAM）：延迟 ~200-400 cycles，带宽 ~数百 GB/s\n' +
      '  - 典型 reduce：workgroup 版本比纯 global 版本快 5-20x（取决于问题规模）\n\n' +
      '2) Storage texture vs framebuffer + sampling：\n' +
      '  - storage texture 直接读写：无 RT 切换开销，无 tile-based 解析\n' +
      '  - framebuffer + sampling：需 RT 切换 + 采样管线（filtering/mipmap）开销\n' +
      '  - compute 写 storage texture → fragment 采样：比 compute → buffer → reupload → texture 快 2-5x\n' +
      '  - read-write storage texture：单 pass 卷积比 ping-pong 快 ~2x（省一张 texture + 一次 dispatch）\n\n' +
      '3) read-write access 性能：\n' +
      '  - 同 texture 内 textureLoad + textureStore：可能触发 cache 抖动（读写同一 cache line）\n' +
      '  - 推荐模式：每个 invocation 只读写自己 coord（无 race），或用 atomic（r32uint）\n' +
      '  - 错位读写（如 (x,y) 读 (x+1,y)）：可能 cache miss，但比 ping-pong 仍快\n\n' +
      '4) dispatch 调优影响：\n' +
      '  - workgroup_size 过小（<wave）：占用率低，性能差\n' +
      '  - workgroup_size 过大（>128）：shared 内存限制，可能编译失败\n' +
      '  - 甜蜜点：64-256（视 GPU 架构，NVIDIA 128/256，AMD 64）\n\n' +
      '注：具体数据依 GPU 型号与驱动版本；建议用 WebGPU timestamp query 实测（需 feature "timestamp-query"）。' });
    this._addLog('perf', '已展示 workgroup/storage texture 性能数据（5-20x / 2-5x 加速）');
  }

  _explainLimitsAndBestPractices() {
    this.setState({ compareInfo:
      '===== 限制与最佳实践 =====\n\n' +
      '硬限制（WebGPU 规范）：\n' +
      '  - workgroup_size: x*y*z ≤ 256（默认；部分设备 1024 需 feature "subgroups" 等）\n' +
      '  - workgroup memory: 16KB-32KB / workgroup（依设备，maxComputeWorkgroupStorageSize）\n' +
      '  - storage texture format: 仅 storage-bindable 格式（无 srgb/depth/压缩）\n' +
      '  - storage binding 数: 每阶段有限（通常 8-10，依 limits）\n' +
      '  - dispatch count: x*y*z ≤ maxComputeWorkgroupsPerDimension（通常 65535）\n' +
      '  - read-write access: 需 device.features.has("read-write-storage-texture")（Chrome 113+）\n\n' +
      '查询限制：\n' +
      '  device.limits.maxComputeWorkgroupSizeX/Y/Z\n' +
      '  device.limits.maxComputeWorkgroupsPerDimension\n' +
      '  device.limits.maxStorageBufferBindingSize\n' +
      '  adapter.limits.maxComputeWorkgroupStorageSize\n\n' +
      '最佳实践：\n' +
      '  1) workgroup_size 选 wave 倍数（NVIDIA 32/64，AMD 64），≤ 256\n' +
      '  2) workgroup memory 预算：array<u32,N> = 4N 字节，留余量\n' +
      '  3) workgroupBarrier 仅在必要时调用（每轮 reduce 后），且 control flow uniform\n' +
      '  4) storage texture format 优先 r32uint（支持 atomic）/ rgba8unorm（图像输出）\n' +
      '  5) read-write 替代 ping-pong（需 113+），减少 dispatch 与 texture 占用\n' +
      '  6) 边界检查：global_invocation_id 超出纹理时 early return，避免 UB\n' +
      '  7) mapAsync 读回：bytesPerRow 256 对齐，用 staging buffer（MAP_READ）\n' +
      '  8) 资源释放：texture.destroy() / buffer.destroy() / device.destroy()，避免泄漏\n' +
      '  9) errorScope 包裹危险操作（createTexture/pipeline），定位 validation 错误\n' +
      ' 10) 用 timestamp query 实测性能（feature "timestamp-query"）' });
    this._addLog('best', '已展示 storage texture / workgroup 限制与 10 条最佳实践');
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 与 WebGL 对比与性能最佳实践',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'WebGL vs WebGPU'),
        h(Tag, { color: 'info' }, 'storageTexture vs SSBO'),
        h(Tag, { color: 'warning' }, '性能 / 限制')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'WebGL 无 storage texture（仅 texture + framebuffer），写入需 FBO blit；WebGPU storage texture 直接 bind 到 shader 读写，省 framebuffer blit。storageTexture vs SSBO：前者 2D/3D 坐标访问（textureLoad/Store），后者 1D 线性索引。性能：workgroup storage 远快于 global storage（L1 cache）；storage texture 比 framebuffer+sampling 快（无 RT 开销）。限制：storage texture format 受限、workgroup size ≤ 256、workgroup memory ≤ 16-32KB。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('WebGL vs WebGPU', { type: 'primary', size: 'sm', onClick: () => this._compareWebGL() }),
          this._btn('storageTexture vs SSBO', { size: 'sm', onClick: () => this._compareSSBO() }),
          this._btn('性能数据', { size: 'sm', onClick: () => this._showPerformanceData() }),
          this._btn('限制与最佳实践', { size: 'sm', onClick: () => this._explainLimitsAndBestPractices() })),
        h('div', { class: 'fs-sm text-secondary' }, '对比 / 性能 / 限制：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.compareInfo || '（点击「WebGL vs WebGPU」或「性能数据」）')),
        h(Alert, { type: 'warning', message: 'storage texture 与 workgroup storage 是 WebGPU 高性能并行计算的关键', description: '相比 WebGL 的 framebuffer + fragment 模拟，WebGPU 提供 compute shader + storage texture + workgroup memory 原生支持，性能提升数倍至数十倍。需注意格式限制、workgroup size 上限与内存预算。' }),
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
    return h('div', { class: 'api-lab-page webgpu-storage-texture-page' },
      h('h2', { class: 'section-title' }, 'WebGPU StorageTexture 与 Workgroup Storage 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页深入演示 WebGPU storage texture（GPUTextureUsage.STORAGE_BINDING + writeTexture/copyExternalImageToTexture + texture_storage_2d binding + read-write access）与 workgroup storage（var<workgroup> + workgroupBarrier + reduce 算法），覆盖完整 compute pipeline、mapAsync 读回、错误处理，并对比 WebGL 与 SSBO。'),
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
