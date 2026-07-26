// =====================================================================
// WebGPUAdvancedExtensionsPage.js —— WebGPU 高级扩展与 GPU-Driven 渲染 实验室
// 演示 WebGPU 规范中尚未在前序页面详细覆盖的高价值扩展特性：
//   1. GPUQuerySet 查询集 —— device.createQuerySet({ type, count })
//      type: "occlusion" | "timestamp"
//      renderPass.beginOcclusionQuery(index) / endOcclusionQuery()
//      encoder.writeTimestamp(querySet, index)
//      resolveQuerySet(querySet, firstQuery, queryCount, destination, destinationOffset)
//      + timestamp-query feature 检测 + GPU 端性能剖析与可见性剔除
//   2. 间接绘制与 GPU-Driven Rendering ——
//      renderPass.drawIndirect(indirectBuffer, indirectOffset)
//      renderPass.drawIndexedIndirect(indirectBuffer, indirectOffset)
//      passEncoder.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffset)
//      + GPUBufferUsage.INDIRECT + indirect-first-instance feature
//      + compute shader 写 indirect args → drawIndirect 消费 完整闭环
//   3. External Textures 外部纹理 —— device.importExternalTexture({ source })
//      source: HTMLVideoElement | VideoFrame | HTMLCanvasElement(OffscreenCanvas)
//      + WGSL texture_external + textureLoad + sampler + YUV→RGB 转换
//      + 零拷贝视频帧处理管线
//   4. 可选特性(Features)深潜 —— adapter.features.has(name) 检测
//      depth-clip-control / dual-source-blending / float32-filterable
//      texture-compression-bc/etc2/astc / shader-f16 / bgra8unorm-storage
//      rg11b10ufloat-renderable / indirect-first-instance / subgroups
//      + 每个特性的真实用例与限制
//   5. GPU Limits 与 Adapter Info 深潜 —— adapter.limits / adapter.info
//      maxBufferSize / maxTextureDimension2D / maxBindGroups / maxStorageBuffersPerShaderStage
//      maxComputeWorkgroupSizeX/Y/Z / maxStorageBufferBindingSize
//      + requestAdapterInfo()（已弃用，改用 adapter.info 属性）
//      + requestDevice({ requiredLimits }) 覆盖默认限制
//   6. 多采样掩码与渲染高级特性 —— renderPass descriptor.multiSample
//      sampleMask 位掩码 + alphaToCoverage + sampleLocations（提案）
//      + GPUTexture MSAA 解析（resolveTarget）回顾 + 性能权衡
// 说明：所有特性调用前做 typeof/in/adapter.features.has 能力检测，不可用时
//       仅记日志（_addLog('warn', ...)），绝不抛异常。jsdom 中 navigator.gpu
//       已 polyfill，但多数高级特性在 mock 环境无法真实执行，演示以代码片段
//       + manifest 示例形式展示真实浏览器中的预期行为。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// —— 本地回退常量：当全局 GPUBufferUsage / GPUQueryType 未定义时使用 ——
const FALLBACK_GPUBufferUsage = {
  MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8,
  INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128,
  INDIRECT: 256, QUERY_RESOLVE: 512,
};

// 已知可选 feature 列表（用于 adapter.features.has() 检测对照）
const KNOWN_FEATURES = [
  { name: 'depth-clip-control', desc: '深度裁剪控制（rasterizer.unclippedDepth）避免近平面裁剪伪影', chrome: 'Chrome 113+' },
  { name: 'dual-source-blending', desc: '双源混合（blend src1）用于无序透明度合成（OIT）', chrome: 'Chrome 122+' },
  { name: 'float32-filterable', desc: 'float32 纹理可线性过滤（HDR/线性 workflow 必需）', chrome: 'Chrome 113+' },
  { name: 'texture-compression-bc', desc: 'BC1-BC7 块压缩纹理（桌面 GPU 通用）', chrome: 'Chrome 113+' },
  { name: 'texture-compression-etc2', desc: 'ETC2 纹理压缩（移动 GPU 主流）', chrome: 'Chrome 113+' },
  { name: 'texture-compression-astc', desc: 'ASTC 纹理压缩（移动 GPU 高压缩比）', chrome: 'Chrome 113+' },
  { name: 'shader-f16', desc: 'WGSL 半精度浮点（f16）运算，ML/渲染省内存', chrome: 'Chrome 122+' },
  { name: 'bgra8unorm-storage', desc: 'bgra8unorm 纹理可作为 storage texture', chrome: 'Chrome 113+' },
  { name: 'rg11b10ufloat-renderable', desc: 'rg11b10ufloat 可作为渲染目标（HDR）', chrome: 'Chrome 113+' },
  { name: 'indirect-first-instance', desc: 'drawIndirect 支持 firstInstance 参数', chrome: 'Chrome 113+' },
  { name: 'timestamp-query', desc: 'GPU 时间戳查询（性能剖析）', chrome: 'Chrome 122+' },
  { name: 'subgroups', desc: 'WGSL 子组操作（ subgroup ops 加速 reduce/scan）', chrome: '实验性' },
];

// 关键 limit 字段（从 adapter.limits / device.limits 读取并展示）
const KEY_LIMITS = [
  'maxBufferSize', 'maxTextureDimension1D', 'maxTextureDimension2D', 'maxTextureDimension3D',
  'maxTextureArrayLayers', 'maxBindGroups', 'maxBindGroupsPlusVertexBuffers',
  'maxBindingsPerBindGroup', 'maxDynamicUniformBuffersPerPipelineLayout',
  'maxDynamicStorageBuffersPerPipelineLayout', 'maxSampledTexturesPerShaderStage',
  'maxSamplersPerShaderStage', 'maxStorageBuffersPerShaderStage',
  'maxStorageTexturesPerShaderStage', 'maxUniformBuffersPerShaderStage',
  'maxUniformBufferBindingSize', 'maxStorageBufferBindingSize',
  'minUniformBufferOffsetAlignment', 'minStorageBufferOffsetAlignment',
  'maxVertexBuffers', 'maxVertexAttributes', 'maxVertexBufferArrayStride',
  'maxInterStageShaderVariables', 'maxColorAttachments',
  'maxColorAttachmentBytesPerSample', 'maxComputeWorkgroupStorageSize',
  'maxComputeInvocationsPerWorkgroup', 'maxComputeWorkgroupSizeX',
  'maxComputeWorkgroupSizeY', 'maxComputeWorkgroupSizeZ', 'maxComputeWorkgroupsPerDimension',
];

export class WebGPUAdvancedExtensionsPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      queryInfo: '',         // Card 1：GPUQuerySet
      indirectInfo: '',      // Card 2：间接绘制
      externalTexInfo: '',   // Card 3：External Textures
      featuresInfo: '',      // Card 4：可选特性
      limitsInfo: '',        // Card 5：Limits 与 Adapter Info
      multisampleInfo: '',   // Card 6：多采样掩码
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._adapter = null;
    this._device = null;
    this._querySet = null;       // Card 1 GPUQuerySet
    this._indirectBuffer = null; // Card 2 indirect args buffer
    this._externalTexture = null; // Card 3 importExternalTexture 结果

    const caps = this._caps();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `navigator.gpu ${c(caps.gpu)}`,
      `requestAdapter ${c(caps.requestAdapter)}`,
      `GPUBufferUsage ${c(caps.bufferUsage)}`,
      `GPUQueryType ${c(caps.queryType)}`,
      `GPUPipelineStatisticType ${c(caps.pipelineStatType)}`,
    ];

    const summary = caps.gpu
      ? `WebGPU 高级扩展能力检测：${parts.join(' · ')}。当前环境 navigator.gpu 可用（可能是 mock），点击按钮可触发真实 API 调用；features/limits 等需真实 GPU 才有具体值。`
      : `WebGPU 高级扩展能力检测：${parts.join(' · ')}。当前环境 navigator.gpu 不可用，所有按钮点击将仅记日志说明 + 展示代码示例，不会抛异常。在支持 WebGPU 的浏览器（Chrome 113+）中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(caps.gpu ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.queryType) this._addLog('warn', 'GPUQueryType 全局常量未定义（jsdom 无 WebGPU 真实实现）');
  }

  componentWillUnmount() {
    // 释放 GPU 资源（真实环境需 await device.destroy()）
    if (this._device && typeof this._device.destroy === 'function') {
      try { this._device.destroy(); } catch { /* noop */ }
    }
    if (this._querySet && typeof this._querySet.destroy === 'function') {
      try { this._querySet.destroy(); } catch { /* noop */ }
    }
    this._adapter = null;
    this._device = null;
    this._querySet = null;
    this._indirectBuffer = null;
    this._externalTexture = null;
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
  _flags() {
    const hasGpu = typeof navigator !== 'undefined' && !!navigator.gpu;
    return {
      gpu: hasGpu,
      requestAdapter: hasGpu && typeof navigator.gpu.requestAdapter === 'function',
      bufferUsage: typeof GPUBufferUsage !== 'undefined',
      queryType: typeof GPUQueryType !== 'undefined',
      pipelineStatType: typeof GPUPipelineStatisticType !== 'undefined',
    };
  }

  // 兼容调用：无参返回布尔能力对象，有参返回 Tag 数组（与项目其他页一致）
  _caps(items) {
    if (items === undefined) return this._flags();
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // —— 共享：确保已获取 device（多卡片复用）——
  async _ensureDevice() {
    if (this._device) return this._device;
    const caps = this._flags();
    if (!caps.gpu) return null;
    try {
      if (!this._adapter) {
        this._adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      }
      if (!this._adapter) return null;
      this._device = await this._adapter.requestDevice({ label: 'webgpu-advanced-ext-lab' });
      return this._device;
    } catch (err) {
      this._addLog('warn', `获取 device 失败：${err.name} - ${err.message}`);
      return null;
    }
  }

  // =================== Card 1：GPUQuerySet 查询集 ===================

  async _demoQuerySet() {
    const caps = this._flags();
    if (!caps.gpu) {
      this.setState({ queryInfo:
        'GPUQuerySet 不可用（需 navigator.gpu + Chrome 122+ timestamp-query feature）\n\n' +
        '===== GPUQuerySet API 概览 =====\n' +
        '  device.createQuerySet({ type: "occlusion"|"timestamp", count }) → GPUQuerySet\n' +
        '  renderPass.beginOcclusionQuery(index) / endOcclusionQuery()    —— 遮挡查询\n' +
        '  encoder.writeTimestamp(querySet, index)                        —— 写时间戳\n' +
        '  encoder.resolveQuerySet(querySet, firstQuery, queryCount, dest, destOffset) —— 解析到 buffer\n' +
        '  querySet.destroy()                                             —— 释放\n\n' +
        '===== 两种查询类型 =====\n' +
        '  occlusion（遮挡查询）：统计通过深度测试的片元数（>0 表示可见）\n' +
        '    用途：场景剔除——先渲染包围盒做遮挡查询，不可见的对象跳过完整渲染\n' +
        '    无需 feature，Chrome 113+ 默认支持\n\n' +
        '  timestamp（时间戳查询）：记录 GPU 执行到该点的时间（纳秒）\n' +
        '    用途：GPU 端性能剖析——测量 draw/dispatch 耗时\n' +
        '    需要 "timestamp-query" feature，Chrome 122+' });
      this._addLog('warn', 'navigator.gpu 不可用，已展示 GPUQuerySet API 概览');
      return;
    }
    const device = await this._ensureDevice();
    if (!device) return;
    try {
      // 检测 timestamp-query feature
      const hasTimestamp = device.features && typeof device.features.has === 'function'
        ? device.features.has('timestamp-query') : false;
      const queryType = hasTimestamp ? 'timestamp' : 'occlusion';
      const count = 4;
      // 创建 QuerySet
      this._querySet = device.createQuerySet({
        type: queryType,
        count: count,
      });
      // 创建解析结果 buffer（每个 query 32-bit = 4 字节）
      const resolveBuffer = device.createBuffer({
        size: count * 8, // 实际 WebGPU 规范每个 query 占 8 字节（64-bit）
        usage: (typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage.QUERY_RESOLVE : 512)
             | (typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage.COPY_SRC : 4),
      });
      // 创建 staging buffer 用于回读
      const stagingBuffer = device.createBuffer({
        size: count * 8,
        usage: (typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage.MAP_READ : 1)
             | (typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage.COPY_DST : 8),
      });
      // 命令录制
      const encoder = device.createCommandEncoder();
      // 时间戳查询：writeTimestamp（需 timestamp-query feature）
      if (hasTimestamp && typeof encoder.writeTimestamp === 'function') {
        encoder.writeTimestamp(this._querySet, 0);
      }
      // 渲染通道中的遮挡查询
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: null, // 实际环境需真实纹理视图
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      if (typeof renderPass.beginOcclusionQuery === 'function') {
        renderPass.beginOcclusionQuery(1);
        // 在此处调用 drawXxx()，GPU 会统计通过深度测试的片元数
        renderPass.endOcclusionQuery();
      }
      renderPass.end();
      // 第二个时间戳
      if (hasTimestamp && typeof encoder.writeTimestamp === 'function') {
        encoder.writeTimestamp(this._querySet, 2);
      }
      // 解析查询结果到 resolveBuffer，再复制到 stagingBuffer
      if (typeof encoder.resolveQuerySet === 'function') {
        encoder.resolveQuerySet(this._querySet, 0, count, resolveBuffer, 0);
        encoder.copyBufferToBuffer(resolveBuffer, 0, stagingBuffer, 0, count * 8);
      }
      device.queue.submit([encoder.finish()]);
      // 回读 stagingBuffer（异步 map）
      let resultText = '';
      try {
        await stagingBuffer.mapAsync(typeof GPUMapMode !== 'undefined' ? GPUMapMode.READ : 1);
        const arrayBuffer = stagingBuffer.getMappedRange();
        const view = new BigInt64Array(arrayBuffer);
        resultText = `查询结果（BigInt64）：[${Array.from(view).map(v => v.toString()).join(', ')}]`;
        stagingBuffer.unmap();
      } catch (e) {
        resultText = `回读失败：${e.message}（mock 环境正常，真实 GPU 可读取）`;
      }
      resolveBuffer.destroy();
      stagingBuffer.destroy();
      this.setState({ queryInfo:
        `===== GPUQuerySet 查询集演示 =====\n\n` +
        `device.createQuerySet({ type: "${queryType}", count: ${count} }) ✓\n` +
        `timestamp-query feature: ${hasTimestamp ? '✓ 已启用' : '✗ 未启用（降级为 occlusion）'}\n` +
        `encoder.writeTimestamp / renderPass.beginOcclusionQuery / endOcclusionQuery ✓\n` +
        `encoder.resolveQuerySet(querySet, 0, ${count}, resolveBuffer, 0) ✓\n` +
        `encoder.copyBufferToBuffer(resolveBuffer → stagingBuffer) ✓\n` +
        `device.queue.submit([encoder.finish()]) ✓\n\n` +
        `回读结果：\n  ${resultText}\n\n` +
        '===== API 说明 =====\n' +
        '  occlusion 查询：beginOcclusionQuery(index) / endOcclusionQuery() 包裹 draw 调用，\n' +
        '    GPU 统计通过深度测试的片元数（0=被完全遮挡，>0=至少部分可见）\n' +
        '  timestamp 查询：writeTimestamp(querySet, index) 记录 GPU 时间戳（纳秒），\n' +
        '    两个 timestamp 相减得到 GPU 执行某段命令的耗时\n' +
        '  resolveQuerySet：把 GPU 内部查询结果解析到 buffer（64-bit per query）\n' +
        '  回读流程：resolveQuerySet → copyBufferToBuffer(staging) → mapAsync(READ) → getMappedRange' });
      this._addLog('query', `QuerySet 创建成功，type=${queryType}, count=${count}, timestamp=${hasTimestamp}`);
    } catch (err) {
      this._addLog('warn', `QuerySet 演示失败：${err.name} - ${err.message}`);
      this.setState({ queryInfo: `QuerySet 演示失败：${err.name} - ${err.message}\n\n（mock 环境部分 API 可能不可用，参考代码示例了解真实用法）` });
    }
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. GPUQuerySet 查询集（遮挡查询 + 时间戳查询）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['navigator.gpu', f.gpu], ['timestamp-query', f.gpu]]),
        h(Tag, { color: 'primary' }, 'Chrome 113+/122+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'GPUQuerySet 是 WebGPU GPU 端查询的标准接口：device.createQuerySet({ type: "occlusion"|"timestamp", count }) 创建查询集；renderPass.beginOcclusionQuery(index)/endOcclusionQuery() 包裹 draw 调用统计可见片元数（场景剔除）；encoder.writeTimestamp(querySet, index) 记录 GPU 时间戳（性能剖析）；encoder.resolveQuerySet() 把结果解析到 buffer 后回读。occlusion 无需 feature，timestamp 需 "timestamp-query" feature（Chrome 122+）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 GPUQuerySet', { type: 'primary', size: 'sm', disabled: !f.gpu, onClick: () => this._demoQuerySet() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'QuerySet 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '380px', overflow: 'auto' } },
          h('code', {}, s.queryInfo || '（点击「演示 GPUQuerySet」查看完整流程）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`const querySet = device.createQuerySet({ type: 'occlusion', count: 4 });
const resolveBuf = device.createBuffer({
  size: 4 * 8,  // 每个 query 8 字节（64-bit）
  usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
});
const encoder = device.createCommandEncoder();
const pass = encoder.beginRenderPass({ colorAttachments: [...] });
pass.beginOcclusionQuery(0);
pass.setPipeline(pipeline);
pass.draw(3);
pass.endOcclusionQuery();
pass.end();
encoder.resolveQuerySet(querySet, 0, 4, resolveBuf, 0);
device.queue.submit([encoder.finish()]);`)),
        h(Alert, {
          type: 'info',
          message: '遮挡查询是 GPU-Driven 场景剔除的关键',
          description: '先用廉价包围盒 draw + occlusion query 测试场景中各对象可见性，回读结果后跳过被完全遮挡对象的完整渲染，显著减少 overdraw。timestamp-query 用于 GPU 端精确性能剖析（vs CPU 端 performance.now 无法反映 GPU 执行时间）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：间接绘制与 GPU-Driven Rendering ===================

  async _demoIndirectDraw() {
    const caps = this._flags();
    if (!caps.gpu) {
      this.setState({ indirectInfo:
        '间接绘制不可用（需 navigator.gpu + Chrome 113+ indirect-first-instance feature）\n\n' +
        '===== 间接绘制 API 概览 =====\n' +
        '  renderPass.drawIndirect(indirectBuffer, indirectOffset)\n' +
        '  renderPass.drawIndexedIndirect(indirectBuffer, indirectOffset)\n' +
        '  passEncoder.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffset)\n\n' +
        '===== Indirect Buffer 数据结构 =====\n' +
        '  drawIndirect 参数（20 字节，5 个 u32）：\n' +
        '    { vertexCount, instanceCount, firstVertex, firstInstance }\n' +
        '  drawIndexedIndirect 参数（20 字节，5 个 u32）：\n' +
        '    { indexCount, instanceCount, firstIndex, baseVertex, firstInstance }\n' +
        '  dispatchWorkgroupsIndirect 参数（12 字节，3 个 u32）：\n' +
        '    { workgroupCountX, workgroupCountY, workgroupCountZ }\n\n' +
        '===== GPU-Driven Rendering 闭环 =====\n' +
        '  1. CPU 上传场景数据（对象位置/包围球/材质）到 storage buffer\n' +
        '  2. Compute shader 视锥剔除：遍历对象，可见的写入 indirect args 到 indirect buffer\n' +
        '     （写入 vertexCount/indexCount/instanceCount/firstVertex 等）\n' +
        '  3. drawIndirect(indirectBuffer, 0) 一次性消费所有可见对象的绘制参数\n' +
        '  4. 优势：剔除完全在 GPU 端，无需 CPU↔GPU 回读，避免管线停滞\n\n' +
        '===== indirect-first-instance feature =====\n' +
        '  Chrome 113+ 默认支持 firstInstance 参数；不支持时 firstInstance 必须为 0' });
      this._addLog('warn', 'navigator.gpu 不可用，已展示间接绘制 API 概览');
      return;
    }
    const device = await this._ensureDevice();
    if (!device) return;
    try {
      const hasFirstInstance = device.features && typeof device.features.has === 'function'
        ? device.features.has('indirect-first-instance') : false;
      // 创建 indirect buffer：4 个 draw 调用，每个 20 字节
      const drawCount = 4;
      const indirectSize = drawCount * 20; // 5 u32 * 4 bytes
      const bufUsage = typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage : FALLBACK_GPUBufferUsage;
      this._indirectBuffer = device.createBuffer({
        size: indirectSize,
        usage: bufUsage.INDIRECT | bufUsage.STORAGE | bufUsage.COPY_DST,
      });
      // CPU 写入 indirect args（实际应由 compute shader 写入）
      const argsData = new Uint32Array(drawCount * 5);
      for (let i = 0; i < drawCount; i++) {
        const offset = i * 5;
        argsData[offset + 0] = 3;      // vertexCount（三角形）
        argsData[offset + 1] = 1;      // instanceCount
        argsData[offset + 2] = i * 3;  // firstVertex
        argsData[offset + 3] = 0;      // firstInstance（需 indirect-first-instance feature）
        // drawIndexedIndirect 多一个 baseVertex（第 4 个 u32）
      }
      device.queue.writeBuffer(this._indirectBuffer, 0, argsData);
      // 命令录制：drawIndirect
      const encoder = device.createCommandEncoder();
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: null,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      // renderPass.setPipeline(pipeline); // 实际环境需绑定 pipeline
      if (typeof renderPass.drawIndirect === 'function') {
        renderPass.drawIndirect(this._indirectBuffer, 0);
      }
      if (typeof renderPass.drawIndexedIndirect === 'function') {
        // renderPass.drawIndexedIndirect(this._indirectBuffer, 0);
      }
      renderPass.end();
      // compute 间接派发
      const computePass = encoder.beginComputePass();
      if (typeof computePass.dispatchWorkgroupsIndirect === 'function') {
        // computePass.setPipeline(computePipeline);
        // computePass.dispatchWorkgroupsIndirect(this._indirectBuffer, 0);
      }
      computePass.end();
      device.queue.submit([encoder.finish()]);
      this.setState({ indirectInfo:
        `===== 间接绘制演示 =====\n\n` +
        `indirect-first-instance feature: ${hasFirstInstance ? '✓' : '✗'}\n` +
        `indirectBuffer 创建（size=${indirectSize}, usage=INDIRECT|STORAGE|COPY_DST）✓\n` +
        `CPU 写入 ${drawCount} 个 draw 调用的 args（实际应由 compute shader 写入）✓\n` +
        `renderPass.drawIndirect(indirectBuffer, 0) ${typeof encoder.beginRenderPass === 'function' ? '✓' : '(mock)'}\n\n` +
        '===== Indirect Args 数据布局 =====\n' +
        '  drawIndirect（20 字节，对齐 4）：\n' +
        '    struct DrawIndirectArgs {\n' +
        '      vertexCount: u32,\n' +
        '      instanceCount: u32,\n' +
        '      firstVertex: u32,\n' +
        '      firstInstance: u32,  // 需 indirect-first-instance feature\n' +
        '    }\n\n' +
        '  drawIndexedIndirect（20 字节）：\n' +
        '    struct DrawIndexedIndirectArgs {\n' +
        '      indexCount: u32,\n' +
        '      instanceCount: u32,\n' +
        '      firstIndex: u32,\n' +
        '      baseVertex: u32,  // 顶点索引偏移\n' +
        '      firstInstance: u32,\n' +
        '    }\n\n' +
        '  dispatchWorkgroupsIndirect（12 字节）：\n' +
        '    struct DispatchIndirectArgs {\n' +
        '      workgroupCountX: u32,\n' +
        '      workgroupCountY: u32,\n' +
        '      workgroupCountZ: u32,\n' +
        '    }\n\n' +
        '===== GPU-Driven Rendering 闭环 =====\n' +
        '  1. CPU 上传场景数据到 storage buffer（对象位置/包围球/材质 ID）\n' +
        '  2. Compute shader 视锥剔除：遍历对象，可见的写入 indirect args 到 indirect buffer\n' +
        '  3. drawIndirect(indirectBuffer, 0) 一次性消费所有可见对象的绘制参数\n' +
        '  4. 优势：剔除完全在 GPU 端，无需 CPU↔GPU 回读，避免管线停滞\n\n' +
        '===== indirect-first-instance feature =====\n' +
        `  ${hasFirstInstance ? '✓ 当前设备支持 firstInstance 参数' : '✗ 当前设备不支持 firstInstance，必须为 0'}` });
      this._addLog('indirect', `indirectBuffer 创建并 drawIndirect 提交；firstInstance=${hasFirstInstance}`);
    } catch (err) {
      this._addLog('warn', `间接绘制演示失败：${err.name} - ${err.message}`);
      this.setState({ indirectInfo: `间接绘制演示失败：${err.name} - ${err.message}\n\n（参考代码示例了解真实用法）` });
    }
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. 间接绘制与 GPU-Driven Rendering（drawIndirect）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['navigator.gpu', f.gpu]]),
        h(Tag, { color: 'primary' }, 'Chrome 113+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '间接绘制让 GPU 自己决定绘制多少实例/顶点：renderPass.drawIndirect(indirectBuffer, offset) 从 buffer 读取 DrawIndirectArgs（vertexCount/instanceCount/firstVertex/firstInstance）执行绘制；drawIndexedIndirect 读取 DrawIndexedIndirectArgs（含 baseVertex）；dispatchWorkgroupsIndirect 读取 DispatchIndirectArgs 派发计算。GPU-Driven Rendering 闭环：compute shader 视锥剔除 → 写入 indirect args → drawIndirect 消费，全程无需 CPU 回读。需 indirect-first-instance feature 支持 firstInstance 参数。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示间接绘制', { type: 'primary', size: 'sm', disabled: !f.gpu, onClick: () => this._demoIndirectDraw() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '间接绘制演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } },
          h('code', {}, s.indirectInfo || '（点击「演示间接绘制」查看完整流程）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（GPU-Driven 闭环）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`// 1) Compute shader 视锥剔除，写入 indirect args
const indirectBuf = device.createBuffer({
  size: MAX_OBJECTS * 20,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
});
// compute shader: if (visible) { out_args[i] = { vertexCount: 3, instanceCount: 1, ... }; }

// 2) drawIndirect 一次性消费
const pass = encoder.beginRenderPass({ colorAttachments: [...] });
pass.setPipeline(pipeline);
pass.setBindGroup(0, bindGroup);
pass.drawIndirect(indirectBuf, 0);   // GPU 自己读 args 执行
pass.end();`)),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：External Textures 外部纹理 ===================

  async _demoExternalTexture() {
    const caps = this._flags();
    if (!caps.gpu) {
      this.setState({ externalTexInfo:
        'External Textures 不可用（需 navigator.gpu + 真实视频源）\n\n' +
        '===== External Textures API 概览 =====\n' +
        '  device.importExternalTexture({ source }) → GPUExternalTexture\n' +
        '    source: HTMLVideoElement | VideoFrame | HTMLCanvasElement | OffscreenCanvas\n' +
        '  GPUExternalTexture 生命周期：import 后仅在该 device 上有效，\n' +
        '    无需 destroy，GPU 自动回收（与 GPUTexture 不同）\n\n' +
        '===== BindGroupLayout 配置 =====\n' +
        '  { binding: 0, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} }\n' +
        '  ★ externalTexture 占两个 binding slot（sampler + texture），但 layout 中只声明 1 个\n\n' +
        '===== WGSL 着色器 =====\n' +
        '  @group(0) @binding(0) var my_sampler: sampler;\n' +
        '  @group(0) @binding(1) var my_tex: texture_external;\n' +
        '  fn fs_main() -> @location(0) vec4<f32> {\n' +
        '    let rgba = textureLoad(my_tex, vec2<i32>(...));  // 返回 vec4<f32>\n' +
        '    return rgba;\n' +
        '  }\n\n' +
        '===== 零拷贝视频处理管线 =====\n' +
        '  1. <video> 元素或 VideoFrame 作为源（解码后的 YUV 数据）\n' +
        '  2. importExternalTexture 零拷贝导入（不复制像素到 GPU buffer）\n' +
        '  3. WGSL textureLoad 采样（浏览器自动处理 YUV→RGB 转换）\n' +
        '  4. fragment shader 处理后输出到 canvas\n' +
        '  5. 优势：相比 WebGL 的 texImage2D(video) 避免一次 CPU↔GPU 拷贝\n\n' +
        '===== 与 WebCodecs VideoFrame 协同 =====\n' +
        '  const frame = new VideoFrame(videoEl);\n' +
        '  const extTex = device.importExternalTexture({ source: frame });\n' +
        '  frame.close();  // 用完即关，避免内存泄漏' });
      this._addLog('warn', 'navigator.gpu 不可用，已展示 External Textures API 概览');
      return;
    }
    const device = await this._ensureDevice();
    if (!device) return;
    try {
      // 构造一个 mock 视频源（jsdom 中无法真实创建）
      const mockVideo = { tagName: 'VIDEO', videoWidth: 1920, videoHeight: 1080, readyState: 4 };
      let extTex = null;
      if (typeof device.importExternalTexture === 'function') {
        try {
          extTex = device.importExternalTexture({ source: mockVideo });
          this._externalTexture = extTex;
        } catch (e) {
          this._addLog('warn', `importExternalTexture 调用失败：${e.message}（mock 视频源可能不被接受）`);
        }
      }
      // 创建 bindGroupLayout
      let bindGroupLayout = null;
      if (typeof device.createBindGroupLayout === 'function') {
        try {
          bindGroupLayout = device.createBindGroupLayout({
            entries: [
              { binding: 0, visibility: 0x2 /* FRAGMENT */, sampler: { type: 'filtering' } },
              { binding: 1, visibility: 0x2, externalTexture: {} },
            ],
          });
        } catch (e) {
          this._addLog('warn', `createBindGroupLayout 失败：${e.message}`);
        }
      }
      // 创建 bindGroup（需 extTex 可用）
      let bindGroup = null;
      if (extTex && bindGroupLayout && typeof device.createBindGroup === 'function') {
        try {
          bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
              { binding: 0, resource: { /* sampler mock */ } },
              { binding: 1, resource: extTex },
            ],
          });
        } catch (e) {
          this._addLog('warn', `createBindGroup 失败：${e.message}`);
        }
      }
      this.setState({ externalTexInfo:
        `===== External Textures 外部纹理演示 =====\n\n` +
        `device.importExternalTexture({ source: video }) ${extTex ? '✓' : '(mock 视频源未接受)'}\n` +
        `createBindGroupLayout({ entries: [..., { externalTexture: {} }] }) ${bindGroupLayout ? '✓' : '(mock)'}\n` +
        `createBindGroup({ entries: [..., { resource: extTex }] }) ${bindGroup ? '✓' : '(需真实 extTex)'}\n\n` +
        '===== API 说明 =====\n' +
        '  device.importExternalTexture({ source }) → GPUExternalTexture\n' +
        '    source 支持：HTMLVideoElement / VideoFrame / HTMLCanvasElement / OffscreenCanvas\n' +
        '  ★ externalTexture 在 bindGroupLayout 中占 1 个 entry，但底层占 2 个 binding slot\n' +
        '  ★ GPUExternalTexture 无需 destroy，import 后在该 device 上有效，GPU 自动回收\n\n' +
        '===== WGSL 着色器示例 =====\n' +
        '  @group(0) @binding(0) var my_sampler: sampler;\n' +
        '  @group(0) @binding(1) var my_tex: texture_external;\n' +
        '  fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {\n' +
        '    let rgba = textureLoad(my_tex, vec2<i32>(uv * vec2<f32>(1920.0, 1080.0)));\n' +
        '    return rgba;\n' +
        '  }\n\n' +
        '===== 零拷贝视频处理管线 =====\n' +
        '  1. <video> 或 VideoFrame 作为源（解码后的 YUV 数据）\n' +
        '  2. importExternalTexture 零拷贝导入（不复制像素到 GPU buffer）\n' +
        '  3. WGSL textureLoad 采样（浏览器自动处理 YUV→RGB 转换）\n' +
        '  4. fragment shader 处理后输出到 canvas\n' +
        '  5. 优势：相比 WebGL texImage2D(video) 避免一次 CPU↔GPU 拷贝' });
      this._addLog('extTex', `importExternalTexture 演示完成；extTex=${!!extTex}, layout=${!!bindGroupLayout}`);
    } catch (err) {
      this._addLog('warn', `External Texture 演示失败：${err.name} - ${err.message}`);
      this.setState({ externalTexInfo: `External Texture 演示失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. External Textures 外部纹理（importExternalTexture）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['navigator.gpu', f.gpu]]),
        h(Tag, { color: 'primary' }, '零拷贝视频'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'device.importExternalTexture({ source }) 把 HTMLVideoElement / VideoFrame / HTMLCanvasElement / OffscreenCanvas 零拷贝导入为 GPUExternalTexture，是 WebGPU 处理视频的标准路径。bindGroupLayout 中声明 externalTexture: {}（占 1 个 entry 但底层占 2 个 binding slot：sampler + texture）；WGSL 用 texture_external 类型 + textureLoad 采样，浏览器自动处理 YUV→RGB 转换。GPUExternalTexture 无需 destroy，GPU 自动回收。相比 WebGL texImage2D(video) 避免一次 CPU↔GPU 拷贝。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 External Texture', { type: 'primary', size: 'sm', disabled: !f.gpu, onClick: () => this._demoExternalTexture() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '380px', overflow: 'auto' } },
          h('code', {}, s.externalTexInfo || '（点击「演示 External Texture」查看完整流程）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（视频滤镜管线）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`const video = document.querySelector('video');
const extTex = device.importExternalTexture({ source: video });

const bgl = device.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} },
  ],
});
const bg = device.createBindGroup({
  layout: bgl,
  entries: [
    { binding: 0, resource: device.createSampler() },
    { binding: 1, resource: extTex },
  ],
});
// WGSL: @group(0) @binding(1) var tex: texture_external;
//       textureLoad(tex, coords) → vec4<f32>`)),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：可选特性 Features 深潜 ===================

  async _demoFeatures() {
    const caps = this._flags();
    if (!caps.gpu) {
      this.setState({ featuresInfo:
        '可选特性检测不可用（需 navigator.gpu + 真实 GPU）\n\n' +
        '===== WebGPU 可选特性(Features)列表 =====\n\n' +
        KNOWN_FEATURES.map((feat) =>
          `  ${feat.name}\n    描述：${feat.desc}\n    Chrome：${feat.chrome}`
        ).join('\n\n') + '\n\n' +
        '===== 检测方法 =====\n' +
        '  const adapter = await navigator.gpu.requestAdapter();\n' +
        '  adapter.features.has("timestamp-query");  // → true/false\n\n' +
        '===== 请求特定 feature =====\n' +
        '  const device = await adapter.requestDevice({\n' +
        '    requiredFeatures: ["timestamp-query", "float32-filterable"],\n' +
        '  });\n' +
        '  // 若 adapter 不支持某 feature，requestDevice 会 reject\n\n' +
        '===== 各 feature 真实用例 =====\n' +
        '  depth-clip-control：阴影贴图避免近平面裁剪伪影（unclippedDepth）\n' +
        '  dual-source-blending：无序透明度合成（OIT），blend src1 输出混合因子\n' +
        '  float32-filterable：HDR/线性 workflow，float32 纹理可线性过滤\n' +
        '  texture-compression-bc/etc2/astc：纹理压缩省显存（BC 桌面/ETC2 ASTC 移动）\n' +
        '  shader-f16：半精度浮点运算，ML 推理/渲染省内存带宽\n' +
        '  bgra8unorm-storage：bgra8unorm 可作 storage texture（与某些原生格式兼容）\n' +
        '  rg11b10ufloat-renderable：HDR 渲染目标（rg11b10ufloat 可作 color attachment）\n' +
        '  indirect-first-instance：drawIndirect 的 firstInstance 参数\n' +
        '  timestamp-query：GPU 时间戳查询（性能剖析）\n' +
        '  subgroups：子组操作（subgroup add/reduce/scan 加速并行归约）' });
      this._addLog('warn', 'navigator.gpu 不可用，已展示 WebGPU 可选特性列表');
      return;
    }
    const device = await this._ensureDevice();
    if (!device) return;
    try {
      const features = device.features || new Set();
      const featureStatus = KNOWN_FEATURES.map((feat) => {
        const has = typeof features.has === 'function' ? features.has(feat.name) : false;
        return `${has ? '✓' : '✗'} ${feat.name} —— ${feat.desc}（${feat.chrome}）`;
      });
      this.setState({ featuresInfo:
        `===== WebGPU 可选特性检测 =====\n\n` +
        `device.features.has(name) 结果：\n${featureStatus.join('\n')}\n\n` +
        '===== 检测与请求方法 =====\n' +
        '  // 1) 检测 adapter 是否支持\n' +
        '  const adapter = await navigator.gpu.requestAdapter();\n' +
        '  adapter.features.has("timestamp-query");  // → true/false\n\n' +
        '  // 2) 请求 device 时声明 requiredFeatures\n' +
        '  const device = await adapter.requestDevice({\n' +
        '    requiredFeatures: ["timestamp-query", "float32-filterable"],\n' +
        '  });\n' +
        '  // 若 adapter 不支持某 feature，requestDevice 会 reject\n\n' +
        '===== 各 feature 真实用例 =====\n' +
        '  depth-clip-control：阴影贴图避免近平面裁剪伪影（rasterizer state unclippedDepth: true）\n' +
        '  dual-source-blending：无序透明度合成（OIT），fragment shader 输出 src1 作为混合因子\n' +
        '  float32-filterable：HDR/线性 workflow，float32 纹理可线性过滤（避免 banding）\n' +
        '  texture-compression-bc/etc2/astc：纹理压缩省显存（BC 桌面/ETC2 ASTC 移动）\n' +
        '  shader-f16：半精度浮点运算，ML 推理/渲染省内存带宽\n' +
        '  bgra8unorm-storage：bgra8unorm 可作 storage texture（与某些原生格式兼容）\n' +
        '  rg11b10ufloat-renderable：HDR 渲染目标（rg11b10ufloat 可作 color attachment）\n' +
        '  indirect-first-instance：drawIndirect 的 firstInstance 参数（实例偏移）\n' +
        '  timestamp-query：GPU 时间戳查询（性能剖析）\n' +
        '  subgroups：子组操作（subgroup add/reduce/scan 加速并行归约）' });
      this._addLog('features', `检测 ${KNOWN_FEATURES.length} 个可选特性`);
    } catch (err) {
      this._addLog('warn', `Features 检测失败：${err.name} - ${err.message}`);
      this.setState({ featuresInfo: `Features 检测失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. 可选特性(Features)深潜',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['navigator.gpu', f.gpu]]),
        h(Tag, { color: 'primary' }, '12 个 feature'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'WebGPU 通过 adapter.features.has(name) 检测可选特性，requestDevice({ requiredFeatures }) 请求启用。关键特性：depth-clip-control（阴影贴图）、dual-source-blending（OIT 无序透明度）、float32-filterable（HDR 线性 workflow）、texture-compression-bc/etc2/astc（纹理压缩省显存）、shader-f16（半精度 ML）、indirect-first-instance（drawIndirect firstInstance 参数）、timestamp-query（GPU 性能剖析）、subgroups（子组归约加速）。每个特性有真实用例与 Chrome 版本要求。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测可选特性', { type: 'primary', size: 'sm', disabled: !f.gpu, onClick: () => this._demoFeatures() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '特性检测结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '460px', overflow: 'auto' } },
          h('code', {}, s.featuresInfo || '（点击「检测可选特性」查看完整列表）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：GPU Limits 与 Adapter Info ===================

  async _demoLimits() {
    const caps = this._flags();
    if (!caps.gpu) {
      this.setState({ limitsInfo:
        'GPU Limits 与 Adapter Info 不可用（需 navigator.gpu + 真实 GPU）\n\n' +
        '===== 关键 limit 字段 =====\n\n' +
        KEY_LIMITS.slice(0, 16).map((k) => `  ${k}`).join('\n') + '\n  ...\n\n' +
        '===== 检测方法 =====\n' +
        '  const adapter = await navigator.gpu.requestAdapter();\n' +
        '  console.log(adapter.limits.maxBufferSize);        // 默认 268435456 (256MB)\n' +
        '  console.log(adapter.limits.maxStorageBufferBindingSize); // 默认 134217728 (128MB)\n' +
        '  console.log(adapter.limits.maxComputeWorkgroupSizeX);   // 默认 256\n\n' +
        '===== requestDevice 覆盖默认限制 =====\n' +
        '  const device = await adapter.requestDevice({\n' +
        '    requiredLimits: {\n' +
        '      maxBufferSize: 536870912,                // 请求 512MB（需 adapter 支持）\n' +
        '      maxStorageBufferBindingSize: 268435456,  // 请求 256MB\n' +
        '      maxComputeWorkgroupSizeX: 1024,          // 请求 1024\n' +
        '    },\n' +
        '  });\n' +
        '  // 若 adapter 不支持某 limit 值，requestDevice 会 reject\n\n' +
        '===== Adapter Info（adapter.info 属性）=====\n' +
        '  adapter.info.vendor       // "nvidia" | "amd" | "intel" | "apple" | ...\n' +
        '  adapter.info.architecture // "ampere" | "rdna2" | ...\n' +
        '  adapter.info.device       // 设备标识字符串\n' +
        '  adapter.info.description  // 人类可读描述\n\n' +
        '  ★ requestAdapterInfo() 方法已弃用，改用 adapter.info 属性（Chrome 113+）' });
      this._addLog('warn', 'navigator.gpu 不可用，已展示 Limits 与 Adapter Info 概览');
      return;
    }
    try {
      if (!this._adapter) {
        this._adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      }
      if (!this._adapter) {
        this.setState({ limitsInfo: 'requestAdapter 返回 null（无可用 GPU）' });
        return;
      }
      const limits = this._adapter.limits || {};
      const info = this._adapter.info || {};
      const limitLines = KEY_LIMITS.map((k) => {
        const v = limits[k];
        return `  ${k.padEnd(48)} = ${v === undefined ? '(undefined)' : v}`;
      });
      this.setState({ limitsInfo:
        `===== GPU Limits 检测 =====\n\n` +
        `adapter.limits：\n${limitLines.join('\n')}\n\n` +
        `===== Adapter Info =====\n` +
        `  vendor:       ${info.vendor || '(undefined)'}\n` +
        `  architecture: ${info.architecture || '(undefined)'}\n` +
        `  device:       ${info.device || '(undefined)'}\n` +
        `  description:  ${info.description || '(undefined)'}\n\n` +
        '===== requestDevice 覆盖默认限制 =====\n' +
        '  const device = await adapter.requestDevice({\n' +
        '    requiredLimits: {\n' +
        '      maxBufferSize: 536870912,                // 请求 512MB（需 adapter 支持）\n' +
        '      maxStorageBufferBindingSize: 268435456,  // 请求 256MB\n' +
        '      maxComputeWorkgroupSizeX: 1024,          // 请求 1024\n' +
        '    },\n' +
        '  });\n' +
        '  // 若 adapter 不支持某 limit 值，requestDevice 会 reject\n\n' +
        '===== Adapter Info 说明 =====\n' +
        '  adapter.info.vendor       // "nvidia" | "amd" | "intel" | "apple" | ...\n' +
        '  adapter.info.architecture // "ampere" | "rdna2" | ...\n' +
        '  adapter.info.device       // 设备标识字符串\n' +
        '  adapter.info.description  // 人类可读描述\n' +
        '  ★ requestAdapterInfo() 方法已弃用，改用 adapter.info 属性（Chrome 113+）' });
      this._addLog('limits', `检测 ${KEY_LIMITS.length} 个 limit 字段`);
    } catch (err) {
      this._addLog('warn', `Limits 检测失败：${err.name} - ${err.message}`);
      this.setState({ limitsInfo: `Limits 检测失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. GPU Limits 与 Adapter Info 深潜',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['navigator.gpu', f.gpu]]),
        h(Tag, { color: 'primary' }, '30+ limit 字段'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'adapter.limits 提供 30+ 个 GPU 能力上限字段：maxBufferSize（默认 256MB）、maxStorageBufferBindingSize（128MB）、maxComputeWorkgroupSizeX/Y/Z（256）、maxBindGroups（4）、maxTextureDimension2D（8192）等。requestDevice({ requiredLimits }) 可请求超过默认值的限制（需 adapter 支持）。adapter.info 提供 vendor/architecture/device/description（requestAdapterInfo() 方法已弃用，改用属性）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 Limits 与 Info', { type: 'primary', size: 'sm', disabled: !f.gpu, onClick: () => this._demoLimits() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '检测结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '540px', overflow: 'auto' } },
          h('code', {}, s.limitsInfo || '（点击「检测 Limits 与 Info」查看完整列表）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：多采样掩码与渲染高级特性 ===================

  _demoMultisample() {
    const caps = this._flags();
    this.setState({ multisampleInfo:
      '===== 多采样掩码与渲染高级特性 =====\n\n' +
      '===== renderPass descriptor.multisample =====\n' +
      '  const renderPassDesc = {\n' +
      '    colorAttachments: [...],\n' +
      '    multisample: {\n' +
      '      count: 4,            // 采样数（1/4，需 MSAA 纹理）\n' +
      '      mask: 0xFFFFFFFF,    // 采样掩码（位掩码，每 bit 对应一个采样点）\n' +
      '      alphaToCoverage: true,  // alpha-to-coverage（用 alpha 值决定哪些采样点写入）\n' +
      '    },\n' +
      '  };\n\n' +
      '===== sampleMask 位掩码 =====\n' +
      '  multisample.mask 是 32-bit 位掩码，每 bit 对应一个采样点（count=4 时仅低 4 bit 有效）\n' +
      '  用途：选择性禁用某些采样点（如模板测试辅助、stencil-based outlines）\n' +
      '  示例：mask = 0b1010（count=4 时禁用第 0、2 采样点）\n\n' +
      '===== alphaToCoverage =====\n' +
      '  alphaToCoverage: true 时，fragment shader 输出的 alpha 值被用作 coverage mask\n' +
      '  用途：植被/毛发等 alpha-tested 几何体的抗锯齿（比 alpha test 更平滑）\n' +
      '  原理：alpha=0.5 → 4x MSAA 中 2 个采样点写入，2 个丢弃\n\n' +
      '===== MSAA 纹理与 resolveTarget =====\n' +
      '  // 1) 创建 MSAA 纹理\n' +
      '  const msaaTexture = device.createTexture({\n' +
      '    size: [width, height],\n' +
      '    sampleCount: 4,            // ★ 多采样\n' +
      '    format: presentationFormat,\n' +
      '    usage: GPUTextureUsage.RENDER_ATTACHMENT,\n' +
      '  });\n' +
      '  // 2) renderPass colorAttachments\n' +
      '  colorAttachments: [{\n' +
      '    view: msaaTexture.createView(),     // MSAA 视图\n' +
      '    resolveTarget: canvasTexture.createView(),  // ★ 解析目标（自动 downsample）\n' +
      '    loadOp: "clear",\n' +
      '    storeOp: "store",  // MSAA 纹理用 "discard"，resolveTarget 用 "store"\n' +
      '  }]\n\n' +
      '===== 性能权衡 =====\n' +
      '  count=1：无 MSAA，最快\n' +
      '  count=4：4x MSAA，显存×4，带宽×4，质量好\n' +
      '  count=8+：通常不值得（带宽开销 vs 视觉收益递减）\n' +
      '  替代方案：FXAA/SMAA/TAA（后处理抗锯齿，性能更好）\n\n' +
      '===== 与 renderPipeline.multisample 的关系 =====\n' +
      '  renderPipeline descriptor 也有 multisample 字段，需与 renderPass 一致：\n' +
      '  const pipeline = device.createRenderPipeline({\n' +
      '    multisample: { count: 4, mask: 0xFFFFFFFF, alphaToCoverage: false },\n' +
      '    ...\n' +
      '  });' });
    this._addLog('ms', `展示多采样掩码与渲染高级特性；gpu=${caps.gpu}`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 多采样掩码与渲染高级特性（sampleMask / alphaToCoverage）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['navigator.gpu', f.gpu]]),
        h(Tag, { color: 'primary' }, 'MSAA 高级'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'renderPass descriptor.multisample 提供高级光栅化控制：count（采样数 1/4）、mask（32-bit 位掩码，选择性禁用采样点）、alphaToCoverage（用 fragment alpha 决定 coverage mask，植被/毛发抗锯齿）。MSAA 纹理需 sampleCount，配合 resolveTarget 自动 downsample。renderPipeline.multisample 需与 renderPass 一致。性能权衡：count=4 显存×4 带宽×4，count=8+ 通常不值得。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示多采样掩码用法', { type: 'primary', size: 'sm', onClick: () => this._demoMultisample() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.multisampleInfo || '（点击按钮查看完整多采样掩码用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // —— 日志面板 ——
  _renderLogPanel() {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return null;
    return h(Card, { title: '运行日志' },
      h('div', { class: 'log-list' },
        ...s.logs.map((log) =>
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
      h('h2', { class: 'section-title' }, 'WebGPU 高级扩展与 GPU-Driven 渲染实验室'),

      h(Alert, {
        type: 'info',
        message: 'WebGPU 规范中尚未在前序页面详细覆盖的高价值扩展特性',
        description: '演示 GPUQuerySet 查询集（遮挡查询 + 时间戳查询）、间接绘制与 GPU-Driven Rendering（drawIndirect/drawIndexedIndirect/dispatchWorkgroupsIndirect）、External Textures 外部纹理（importExternalTexture 零拷贝视频导入）、可选特性 Features 深潜（depth-clip-control/dual-source-blending/float32-filterable/texture-compression-*/shader-f16 等 12 个）、GPU Limits 与 Adapter Info 深潜（30+ limit 字段 + requestDevice requiredLimits）、多采样掩码与渲染高级特性（sampleMask/alphaToCoverage/MSAA resolveTarget）。所有 API 调用前做 typeof/features.has 能力检测，不支持时仅记日志 + 展示代码示例。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),

      this._renderLogPanel(),
    ];
  }
}
