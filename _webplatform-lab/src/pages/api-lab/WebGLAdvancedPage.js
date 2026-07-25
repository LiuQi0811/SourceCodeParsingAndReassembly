// =====================================================================
// WebGLAdvancedPage.js —— WebGL2 高级特性 实验室
// 演示 MDN：
//   1. WebGLSync 同步对象 —— fenceSync / clientWaitSync / waitSync /
//      getSyncParameter / deleteSync（GPU-CPU 同步）
//   2. WebGLQuery 查询对象 —— createQuery / beginQuery / endQuery /
//      getQueryParameter / getQuery / deleteQuery / isQuery（遮挡查询）
//   3. Transform Feedback 变换反馈 —— createTransformFeedback /
//      transformFeedbackVaryings / beginTransformFeedback / pause / resume /
//      bindBufferBase(TRANSFORM_FEEDBACK_BUFFER)（GPU 捕获顶点输出）
//   4. VAO 顶点数组对象与实例化渲染 —— createVertexArray / bindVertexArray /
//      drawArraysInstanced / drawElementsInstanced / vertexAttribDivisor
//   5. 3D 纹理与多重采样 —— texImage3D / texStorage3D / sampler3D /
//      renderbufferStorageMultisample / blitFramebuffer / sampleCoverage
//   6. Uniform Buffer Objects 与扩展 —— bindBufferBase(UNIFORM_BUFFER) /
//      uniformBlockBinding / getUniformBlockIndex / getActiveUniformBlockParameter /
//      std140 布局 / texStorage2D / copyBufferSubData / getBufferSubData /
//      createSampler / getSupportedExtensions / getExtension
// 说明：WebGL2 在 WebGL1 基础上新增 Sync/Query/TransformFeedback/VAO（内置）/
//   3D 纹理/MSAA FBO/UBO/Sampler 等高级特性。本页不重复 AdvancedGraphicsPage
//   已覆盖的基础 context/着色器内容，专注上述深度特性。
//   所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），
//   绝不抛异常。jsdom 中 canvas.getContext 返回 mock（无 fenceSync/createQuery 等），
//   代码必须优雅降级。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// 把字符串数组拼成多行文本（减少源文件行数）
const L = (arr) => arr.join('\n');

export class WebGLAdvancedPage extends Page {
  initialState() {
    return {
      logs: [], capsSummary: '',
      syncInfo: '',   // Card 1：WebGLSync 同步对象
      queryInfo: '',  // Card 2：WebGLQuery 查询对象
      tfInfo: '',     // Card 3：Transform Feedback 变换反馈
      vaoInfo: '',    // Card 4：VAO 顶点数组对象与实例化渲染
      tex3dInfo: '',  // Card 5：3D 纹理与多重采样
      uboInfo: '',    // Card 6：Uniform Buffer Objects 与扩展
    };
  }

  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._gl = null; this._canvas = null; this._loseCtx = null;
    this._syncs = []; this._queries = []; this._vaos = []; this._tfs = [];
    this._buffers = []; this._textures = []; this._programs = []; this._samplers = [];

    // 一次性能力检测：尝试创建 WebGL2 上下文并探测扩展
    const hasCtor = typeof WebGL2RenderingContext !== 'undefined';
    let ctxOk = false, extCount = 0;
    if (hasCtor) {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        this._canvas = canvas; this._gl = gl;
        if (gl) {
          ctxOk = true;
          try { this._loseCtx = gl.getExtension('WEBGL_lose_context'); } catch { /* noop */ }
          try { extCount = (gl.getSupportedExtensions() || []).length; } catch { /* noop */ }
        }
      } catch (err) { this._addLog('warn', `WebGL2 上下文创建异常：${err.name} - ${err.message}`); }
    }

    const has = (m) => !!(ctxOk && typeof this._gl[m] === 'function');
    const parts = [
      `WebGL2RenderingContext ${hasCtor ? '✓' : '✗'}`, `getContext('webgl2') ${ctxOk ? '✓' : '✗'}`,
      `fenceSync ${has('fenceSync') ? '✓' : '✗'}`, `createQuery ${has('createQuery') ? '✓' : '✗'}`,
      `createTransformFeedback ${has('createTransformFeedback') ? '✓' : '✗'}`, `createVertexArray ${has('createVertexArray') ? '✓' : '✗'}`,
      `texImage3D ${has('texImage3D') ? '✓' : '✗'}`, `renderbufferStorageMultisample ${has('renderbufferStorageMultisample') ? '✓' : '✗'}`,
      `bindBufferBase ${has('bindBufferBase') ? '✓' : '✗'}`, `WEBGL_lose_context ${this._loseCtx ? '✓' : '✗'}`,
    ];
    const summary = ctxOk
      ? `WebGL2 能力检测：${parts.join(' · ')}。扩展数：${extCount}。可真实执行 Sync/Query/TF/VAO/3D 纹理/UBO 演示（如方法存在）。`
      : (hasCtor
        ? `WebGL2RenderingContext 已定义但 getContext('webgl2') 返回空/mock，高级方法不可用：${parts.join('，')}。按钮点击仅记录 API 用法，不会抛异常。`
        : `当前环境不支持 WebGL2（typeof WebGL2RenderingContext === "undefined"）；按钮点击仅记录 API 用法，不会抛异常。在支持 WebGL2 的浏览器中可完整演示。`);
    this.setState({ capsSummary: summary });
    this._addLog(ctxOk ? 'info' : 'warn', `能力检测：${parts.join('，')}` + (ctxOk ? `，扩展 ${extCount} 个` : ''));
    if (!ctxOk) this._addLog('warn', 'jsdom 的 canvas.getContext 返回 mock（无 fenceSync/createQuery/createTransformFeedback/texImage3D 等），代码将优雅降级仅记录用法');
  }

  componentWillUnmount() {
    const gl = this._gl;
    if (gl) {
      for (const s of this._syncs) { try { gl.deleteSync(s); } catch { /* noop */ } }
      for (const q of this._queries) { try { gl.deleteQuery(q); } catch { /* noop */ } }
      for (const v of this._vaos) { try { gl.deleteVertexArray(v); } catch { /* noop */ } }
      for (const t of this._tfs) { try { gl.deleteTransformFeedback(t); } catch { /* noop */ } }
      for (const b of this._buffers) { try { gl.deleteBuffer(b); } catch { /* noop */ } }
      for (const t of this._textures) { try { gl.deleteTexture(t); } catch { /* noop */ } }
      for (const p of this._programs) { try { gl.deleteProgram(p); } catch { /* noop */ } }
      for (const sm of this._samplers) { try { gl.deleteSampler(sm); } catch { /* noop */ } }
      if (this._loseCtx) { try { this._loseCtx.loseContext(); } catch { /* noop */ } }
    }
    this._gl = this._canvas = this._loseCtx = null;
    this._syncs = this._queries = this._vaos = this._tfs = [];
    this._buffers = this._textures = this._programs = this._samplers = [];
  }

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
    const hasCtor = typeof WebGL2RenderingContext !== 'undefined';
    const gl = this._gl;
    const has = (m) => !!(gl && typeof gl[m] === 'function');
    return {
      webgl2: hasCtor && !!gl, fenceSync: has('fenceSync'), createQuery: has('createQuery'),
      createTransformFeedback: has('createTransformFeedback'), createVertexArray: has('createVertexArray'),
      texImage3D: has('texImage3D'), renderbufferStorageMultisample: has('renderbufferStorageMultisample'),
      blitFramebuffer: has('blitFramebuffer'), bindBufferBase: has('bindBufferBase'),
      uniformBlockBinding: has('uniformBlockBinding'), createSampler: has('createSampler'),
      getSupportedExtensions: has('getSupportedExtensions'),
    };
  }
  _ensureGL() {
    if (!this._gl) { this._addLog('warn', '无 WebGL2 上下文，无法执行真实演示'); return null; }
    return this._gl;
  }
  _syncResultName(gl, v) {
    if (v === gl.ALREADY_SIGNALED) return 'ALREADY_SIGNALED';
    if (v === gl.TIMEOUT_EXPIRED) return 'TIMEOUT_EXPIRED';
    if (v === gl.CONDITION_SATISFIED) return 'CONDITION_SATISFIED';
    if (v === gl.WAIT_FAILED) return 'WAIT_FAILED';
    return String(v);
  }

  // =================== Card 1：WebGLSync 同步对象 ===================

  _demoFenceSync() {
    const caps = this._caps();
    if (!caps.fenceSync) {
      this.setState({ syncInfo: L([
        'WebGLSync 用法（当前环境不可用，仅说明）：',
        'const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);  // condition 唯一合法值',
        '// clientWaitSync(sync, SYNC_FLUSH_COMMANDS_BIT, timeout) → ALREADY_SIGNALED|TIMEOUT_EXPIRED|CONDITION_SATISFIED',
        'let s = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0);',
        'while (s === gl.TIMEOUT_EXPIRED) { s = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 1e6); }',
        'gl.waitSync(sync, 0, gl.MAX_CLIENT_WAIT_TIMEOUT_WEBGL);  // GPU 侧阻塞，WebGL 不能无限等待',
        'const st = gl.getSyncParameter(sync, gl.SYNC_STATUS);     // → UNSIGNALED | SIGNALED（pname 也可 SYNC_CONDITION/SYNC_FLAGS）',
        'gl.deleteSync(sync);',
        '用途：GPU-CPU 同步，readPixels / getBufferSubData 前等待 GPU 完成渲染。',
        '说明：WebGL 的 waitSync 受限——不能无限阻塞 GPU（与原生 GL 不同），多数用 clientWaitSync 轮询。',
      ]) });
      this._addLog('warn', 'fenceSync 不可用（mock 无此方法），已记录 WebGLSync 用法');
      return;
    }
    const gl = this._ensureGL(); if (!gl) return;
    try {
      this._addLog('sync', 'fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) → 创建同步对象…');
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      this._syncs.push(sync);
      const s1 = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
      let s2 = s1;
      try { s2 = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 1000000); } catch { /* noop */ }
      let statusParam = '(不可查)';
      try {
        const sp = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        statusParam = (sp === gl.UNSIGNALED) ? 'UNSIGNALED' : (sp === gl.SIGNALED) ? 'SIGNALED' : String(sp);
      } catch (err) { statusParam = `查询失败：${err.message}`; }
      let maxWait = '(不可查)';
      try { maxWait = String(gl.getParameter(gl.MAX_CLIENT_WAIT_TIMEOUT_WEBGL)); } catch { /* noop */ }
      this.setState({ syncInfo: L([
        'WebGLSync 同步对象演示：',
        'gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) → WebGLSync ✓',
        `  轮询 clientWaitSync：第1次(timeout=0)→${this._syncResultName(gl, s1)}，第2次(1ms)→${this._syncResultName(gl, s2)}`,
        '  返回值：ALREADY_SIGNALED / TIMEOUT_EXPIRED / CONDITION_SATISFIED（flags 须含 SYNC_FLUSH_COMMANDS_BIT）',
        `gl.getSyncParameter(sync, gl.SYNC_STATUS) → ${statusParam}`,
        '  pname 取值：gl.SYNC_STATUS(UNSIGNALED|SIGNALED) | gl.SYNC_CONDITION | gl.SYNC_FLAGS',
        'gl.waitSync(sync, 0, gl.MAX_CLIENT_WAIT_TIMEOUT_WEBGL) —— GPU 侧阻塞，CPU 立即返回',
        `  WebGL 限制：timeout 必须 = MAX_CLIENT_WAIT_TIMEOUT_WEBGL（当前值：${maxWait}），不可无限等待`,
        '用途：GPU-CPU 同步。readPixels / getBufferSubData 前等待 GPU 完成渲染。',
      ]) });
      this._addLog('sync', `fenceSync 演示完成：SYNC_STATUS=${statusParam}，第1次=${this._syncResultName(gl, s1)}`);
    } catch (err) { this._addLog('warn', `fenceSync 演示失败：${err.name} - ${err.message}`); }
  }

  _renderCard1() {
    const s = this.state; const caps = this._caps();
    const card = new Card({
      title: '1. WebGLSync 同步对象（fenceSync / clientWaitSync / waitSync）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.fenceSync ? 'success' : 'error' }, caps.fenceSync ? 'fenceSync ✓' : 'fenceSync ✗'),
        h(Tag, { color: 'primary' }, 'GPU-CPU 同步')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) 创建 WebGLSync（condition 必须为 SYNC_GPU_COMMANDS_COMPLETE）。gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, timeout) 在 CPU 侧轮询，返回 ALREADY_SIGNALED / TIMEOUT_EXPIRED / CONDITION_SATISFIED（flags 须含 SYNC_FLUSH_COMMANDS_BIT）。gl.waitSync(sync, 0, gl.MAX_CLIENT_WAIT_TIMEOUT_WEBGL) 仅 GPU 侧阻塞、CPU 立即返回（WebGL 中 timeout 必须为 MAX_CLIENT_WAIT_TIMEOUT_WEBGL，不能无限等待）。gl.getSyncParameter(sync, gl.SYNC_STATUS) 返回 UNSIGNALED / SIGNALED。gl.deleteSync(sync) 释放。用途：readPixels / getBufferSubData 前等待 GPU 完成。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建并轮询 fenceSync', { type: 'primary', size: 'sm', disabled: !caps.webgl2, onClick: () => this._demoFenceSync() })),
        h('div', { class: 'fs-sm text-secondary' }, 'WebGLSync 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.syncInfo || '（点击「创建并轮询 fenceSync」开始演示）')),
        h(Alert, { type: 'info', message: 'waitSync 在 WebGL 中受限',
          description: '原生 GL 的 waitSync 可用 TIMEOUT_IGNORED 实现真正无限 GPU 阻塞，但 WebGL 规范要求 timeout 必须 = gl.MAX_CLIENT_WAIT_TIMEOUT_WEBGL，且实际是否阻塞 GPU 由驱动决定。多数场景用 clientWaitSync 轮询代替。' }),
      ],
    });
    this.registerChild(card); return card.render();
  }

  // =================== Card 2：WebGLQuery 查询对象 ===================

  _demoQuery() {
    const caps = this._caps();
    if (!caps.createQuery) {
      this.setState({ queryInfo: L([
        'WebGLQuery 用法（当前环境不可用，仅说明）：',
        'const query = gl.createQuery();',
        'gl.beginQuery(gl.ANY_SAMPLES_PASSED, query);   // 或 ANY_SAMPLES_PASSED_CONSERVATIVE（保守更快）',
        '  gl.drawArrays(gl.TRIANGLES, 0, n);          // 绘制要查询的几何',
        'gl.endQuery(gl.ANY_SAMPLES_PASSED);',
        '// TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN：查 TF 写入图元数',
        '// 结果异步：必须等 QUERY_RESULT_AVAILABLE 为 true 才能读 QUERY_RESULT',
        'function poll() {',
        '  if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {',
        '    const r = gl.getQueryParameter(query, gl.QUERY_RESULT); // boolean(遮挡) | number(图元数)',
        '  } else { requestAnimationFrame(poll); }',
        '}',
        'gl.getQuery(gl.ANY_SAMPLES_PASSED, gl.CURRENT_QUERY);       // 当前 query 或 null',
        'gl.getQuery(gl.ANY_SAMPLES_PASSED, gl.QUERY_COUNTER_BITS); // 计数器位数',
        'gl.deleteQuery(query); gl.isQuery(query);  // false',
        '用途：遮挡剔除（几何是否到达像素）、TF 图元计数。结果异步需轮询。',
      ]) });
      this._addLog('warn', 'createQuery 不可用（mock 无此方法），已记录 WebGLQuery 用法');
      return;
    }
    const gl = this._ensureGL(); if (!gl) return;
    try {
      this._addLog('query', 'createQuery() → 创建遮挡查询对象…');
      const query = gl.createQuery();
      this._queries.push(query);
      const isQ1 = gl.isQuery(query);
      try { gl.beginQuery(gl.ANY_SAMPLES_PASSED, query); } catch { /* noop */ }
      try { gl.endQuery(gl.ANY_SAMPLES_PASSED); } catch { /* noop */ }
      let avail = false, resultVal = '(未读)';
      try { avail = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE); } catch (err) { avail = `(异常:${err.message})`; }
      try { if (avail === true) resultVal = String(gl.getQueryParameter(query, gl.QUERY_RESULT)); } catch (err) { resultVal = `读取失败:${err.message}`; }
      let counterBits = '(不可查)';
      try { counterBits = String(gl.getQuery(gl.ANY_SAMPLES_PASSED, gl.QUERY_COUNTER_BITS)); } catch (err) { counterBits = `异常:${err.message}`; }
      const isQ2 = gl.isQuery(query);
      this.setState({ queryInfo: L([
        'WebGLQuery 查询对象演示：',
        `gl.createQuery() → WebGLQuery ✓（isQuery：创建后=${isQ1}，使用后=${isQ2}）`,
        'gl.beginQuery(gl.ANY_SAMPLES_PASSED, query) + drawArrays + gl.endQuery(gl.ANY_SAMPLES_PASSED)',
        '  target：ANY_SAMPLES_PASSED(精确遮挡) | ANY_SAMPLES_PASSED_CONSERVATIVE(保守更快) | TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN(TF 图元数)',
        `gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) → ${avail}（结果异步，刚 endQuery 后通常未就绪，需轮询）`,
        `gl.getQueryParameter(query, gl.QUERY_RESULT) → ${resultVal}`,
        '  ANY_SAMPLES_PASSED 返回 boolean；TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN 返回 number',
        `gl.getQuery(gl.ANY_SAMPLES_PASSED, gl.QUERY_COUNTER_BITS) → ${counterBits}`,
        '  pname：gl.CURRENT_QUERY（当前激活 query） | gl.QUERY_COUNTER_BITS（计数器位数）',
        'gl.deleteQuery(query) 释放；gl.isQuery(query) 判活。',
        '用途：遮挡剔除（物体被遮挡则跳过复杂绘制）、TF 图元计数（GPU 粒子系统真实粒子数）。',
      ]) });
      this._addLog('query', `createQuery 演示完成：QUERY_RESULT_AVAILABLE=${avail}，QUERY_RESULT=${resultVal}`);
    } catch (err) { this._addLog('warn', `createQuery 演示失败：${err.name} - ${err.message}`); }
  }

  _renderCard2() {
    const s = this.state; const caps = this._caps();
    const card = new Card({
      title: '2. WebGLQuery 查询对象（createQuery / beginQuery / getQueryParameter）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.createQuery ? 'success' : 'error' }, caps.createQuery ? 'createQuery ✓' : 'createQuery ✗'),
        h(Tag, { color: 'primary' }, '遮挡查询 / TF 计数')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'gl.createQuery() 创建 WebGLQuery。gl.beginQuery(target, query) / gl.endQuery(target)，target ∈ gl.ANY_SAMPLES_PASSED（精确遮挡）/ gl.ANY_SAMPLES_PASSED_CONSERVATIVE（保守遮挡，更快）/ gl.TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN（TF 写入图元数）。gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) 返回 boolean 是否就绪，gl.QUERY_RESULT 返回具体值（遮挡为 boolean、TF 为 number）。gl.getQuery(target, gl.CURRENT_QUERY | gl.QUERY_COUNTER_BITS)。gl.deleteQuery / gl.isQuery。结果异步，需轮询。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建并查询', { type: 'primary', size: 'sm', disabled: !caps.webgl2, onClick: () => this._demoQuery() })),
        h('div', { class: 'fs-sm text-secondary' }, 'WebGLQuery 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.queryInfo || '（点击「创建并查询」开始演示）')),
        h(Alert, { type: 'warning', message: '查询结果不会立即可用',
          description: 'endQuery 后 QUERY_RESULT_AVAILABLE 通常为 false（GPU 异步执行），需轮询直到 true 再读 QUERY_RESULT。ANY_SAMPLES_PASSED_CONSERVATIVE 比 ANY_SAMPLES_PASSED 快但可能误报可见。遮挡查询用于遮挡剔除：若物体完全被遮挡，跳过其复杂绘制。' }),
      ],
    });
    this.registerChild(card); return card.render();
  }

  // =================== Card 3：Transform Feedback 变换反馈 ===================

  _demoTransformFeedback() {
    const caps = this._caps();
    if (!caps.createTransformFeedback) {
      this.setState({ tfInfo: L([
        'Transform Feedback 用法（当前环境不可用，仅说明代码流程）：',
        '// GLSL ES 3.00 顶点着色器：用 out 输出变量',
        '#version 300 es',
        'in vec3 aPos; out vec3 vPos; uniform mat4 uMVP;',
        'void main() { vPos = aPos; gl_Position = uMVP * vec4(aPos, 1.0); }',
        '// 1. 创建 program，必须在 link 前指定 varyings',
        'gl.transformFeedbackVaryings(prog, ["vPos"], gl.INTERLEAVED_ATTRIBS);  // 或 SEPARATE_ATTRIBS',
        'gl.linkProgram(prog);    // ★ 必须 link 之后才能查 varying',
        'const cnt = gl.getProgramParameter(prog, gl.TRANSFORM_FEEDBACK_VARYINGS);',
        'const info = gl.getTransformFeedbackVarying(prog, 0);  // → WebGLActiveInfo {name,type,size}',
        '// 2. 创建 TF 对象 + 捕获 buffer',
        'const tf = gl.createTransformFeedback();',
        'gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);',
        'gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, tfBuf);  // index 对应 varying 顺序',
        '// 3. 开始 TF 捕获 → draw → 结束',
        'gl.beginTransformFeedback(gl.TRIANGLES);  // POINTS | LINES | TRIANGLES',
        '  gl.drawArrays(gl.TRIANGLES, 0, vertexCount);',
        'gl.endTransformFeedback();  // 暂停/恢复：pauseTransformFeedback() / resumeTransformFeedback()',
        '// 4. 读回捕获的顶点数据（GPU→CPU）',
        'const data = gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, new Float32Array(outLen));',
        '用途：GPU 粒子系统、级联骨骼动画、计算型顶点变换（无需读回的 GPU 内循环）。',
        '说明：varyings 必须在 linkProgram 前设置；bufferMode = INTERLEAVED_ATTRIBS(打包一个 buffer) | SEPARATE_ATTRIBS(每 varying 一个 buffer)。',
      ]) });
      this._addLog('warn', 'createTransformFeedback 不可用（mock 无此方法），已记录 TF 用法');
      return;
    }
    const gl = this._ensureGL(); if (!gl) return;
    try {
      this._addLog('tf', 'createTransformFeedback() → 创建 TF 对象…');
      const tf = gl.createTransformFeedback();
      this._tfs.push(tf);
      try { gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf); } catch { /* noop */ }
      const tfBuf = gl.createBuffer(); this._buffers.push(tfBuf);
      let bindOk = false;
      try { gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, tfBuf); bindOk = true; } catch (err) { bindOk = `异常:${err.message}`; }
      let beginOk = '(未执行)', pauseOk = '(未执行)', resumeOk = '(未执行)', endOk = '(未执行)';
      try { gl.beginTransformFeedback(gl.TRIANGLES); beginOk = '成功'; } catch (err) { beginOk = `异常:${err.message}`; }
      try { gl.pauseTransformFeedback(); pauseOk = '成功'; } catch (err) { pauseOk = `异常:${err.message}`; }
      try { gl.resumeTransformFeedback(); resumeOk = '成功'; } catch (err) { resumeOk = `异常:${err.message}`; }
      try { gl.endTransformFeedback(); endOk = '成功'; } catch (err) { endOk = `异常:${err.message}`; }
      this.setState({ tfInfo: L([
        'Transform Feedback 变换反馈演示：',
        'gl.createTransformFeedback() → WebGLTransformFeedback ✓',
        `gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, tfBuf)：${bindOk}（index 对应 transformFeedbackVaryings 顺序）`,
        `begin/pause/resume/end 流程：begin→${beginOk}，pause→${pauseOk}，resume→${resumeOk}，end→${endOk}`,
        '  gl.beginTransformFeedback(primitiveMode)：primitiveMode ∈ gl.POINTS | gl.LINES | gl.TRIANGLES',
        '关键 API（须配合 program）：',
        '  gl.transformFeedbackVaryings(prog, ["vPos"], gl.INTERLEAVED_ATTRIBS) —— ★ linkProgram 前调用',
        '    bufferMode：gl.INTERLEAVED_ATTRIBS(打包一个 buffer) | gl.SEPARATE_ATTRIBS(每 varying 一个 buffer)',
        '  gl.getProgramParameter(prog, gl.TRANSFORM_FEEDBACK_VARYINGS) → varying 计数',
        '  gl.getTransformFeedbackVarying(prog, index) → WebGLActiveInfo {name,type,size}',
        'GLSL 要求：#version 300 es，顶点着色器用 out 输出变量（被捕获的 varying）。',
        '用途：GPU 粒子系统、级联骨骼动画、GPU 端顶点变换（无需 CPU 读回的内循环）。',
      ]) });
      this._addLog('tf', `TF 演示完成：bindBufferBase=${bindOk}，begin=${beginOk}，end=${endOk}`);
    } catch (err) { this._addLog('warn', `TF 演示失败：${err.name} - ${err.message}`); }
  }

  _renderCard3() {
    const s = this.state; const caps = this._caps();
    const card = new Card({
      title: '3. Transform Feedback 变换反馈（createTransformFeedback / transformFeedbackVaryings）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.createTransformFeedback ? 'success' : 'error' }, caps.createTransformFeedback ? 'TF ✓' : 'TF ✗'),
        h(Tag, { color: 'primary' }, 'GPU 捕获顶点输出')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Transform Feedback 把顶点着色器输出（out 变量）捕获到 buffer（GPU 侧，无需读回）。gl.createTransformFeedback() / bindTransformFeedback(target, tf)。gl.transformFeedbackVaryings(program, varyings, bufferMode) —— bufferMode ∈ gl.INTERLEAVED_ATTRIBS（打包一个 buffer）/ gl.SEPARATE_ATTRIBS（每 varying 一个 buffer），★必须在 gl.linkProgram 前调用。gl.getProgramParameter(program, gl.TRANSFORM_FEEDBACK_VARYINGS) 取计数；gl.getTransformFeedbackVarying(program, index) → WebGLActiveInfo。gl.beginTransformFeedback(primitiveMode)（POINTS/LINES/TRIANGLES）/ endTransformFeedback / pauseTransformFeedback / resumeTransformFeedback。gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, index, buffer) 绑定捕获 buffer。GLSL 须 #version 300 es。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 TF 并演示流程', { type: 'primary', size: 'sm', disabled: !caps.webgl2, onClick: () => this._demoTransformFeedback() })),
        h('div', { class: 'fs-sm text-secondary' }, 'Transform Feedback 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.tfInfo || '（点击「创建 TF 并演示流程」开始演示）')),
        h(Alert, { type: 'warning', message: 'transformFeedbackVaryings 必须在 linkProgram 前调用',
          description: '设置 varyings 后必须重新 linkProgram 才生效。GLSL 顶点着色器需 #version 300 es 并用 out 输出变量。INTERLEAVED_ATTRIBS 把所有 varying 打包进一个 buffer；SEPARATE_ATTRIBS 为每个 varying 绑定独立 buffer（用 bindBufferBase 的 index 区分）。beginTransformFeedback 的 primitiveMode 限制 drawArrays 的图元类型。' }),
      ],
    });
    this.registerChild(card); return card.render();
  }

  // =================== Card 4：VAO 顶点数组对象与实例化渲染 ===================

  _demoVAOInstanced() {
    const caps = this._caps();
    if (!caps.createVertexArray) {
      this.setState({ vaoInfo: L([
        'VAO 与实例化渲染用法（当前环境不可用，仅说明）：',
        '// VAO：封装所有顶点属性绑定 + buffer 指针，切换几何只需一次 bind',
        'const vao = gl.createVertexArray();',
        'gl.bindVertexArray(vao);                       // 之后所有 vertexAttribPointer 都记入此 VAO',
        '  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.enableVertexAttribArray(aPos);',
        '  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);',
        'gl.bindVertexArray(null); gl.deleteVertexArray(vao); gl.isVertexArray(vao);  // false',
        '// 实例化渲染：一次 draw 调用绘制大量相同几何',
        'gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, instanceCount);',
        'gl.drawElementsInstanced(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0, instanceCount);',
        '// per-instance 属性：用 divisor 控制属性推进频率',
        'gl.vertexAttribPointer(aOffset, 3, gl.FLOAT, false, 0, 0);',
        'gl.vertexAttribDivisor(aOffset, 1);           // ★ divisor=1 每实例推进一次（默认 0 每顶点推进）',
        '// divisor=2 每 2 个实例推进一次；divisor=0 普通逐顶点属性',
        '用途：一次 draw 渲染 1000 棵树（per-instance transform 放实例化属性），大幅减少 draw call。',
        '说明：WebGL2 内置 VAO（WebGL1 需 OES_vertex_array_object）；实例化内置（WebGL1 需 ANGLE_instanced_arrays）。',
      ]) });
      this._addLog('warn', 'createVertexArray 不可用（mock 无此方法），已记录 VAO + 实例化用法');
      return;
    }
    const gl = this._ensureGL(); if (!gl) return;
    try {
      this._addLog('vao', 'createVertexArray() → 创建 VAO…');
      const vao = gl.createVertexArray();
      this._vaos.push(vao);
      try { gl.bindVertexArray(vao); } catch { /* noop */ }
      const isVao1 = gl.isVertexArray(vao);
      const posBuf = gl.createBuffer(); const offBuf = gl.createBuffer();
      this._buffers.push(posBuf, offBuf);
      try { gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0]), gl.STATIC_DRAW); } catch { /* noop */ }
      try { gl.bindBuffer(gl.ARRAY_BUFFER, offBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(3 * 100), gl.STATIC_DRAW); } catch { /* noop */ }
      let divisorOk = '(未执行)';
      try { gl.vertexAttribDivisor(0, 0); gl.vertexAttribDivisor(1, 1); divisorOk = '成功：aPos divisor=0（逐顶点），aOffset divisor=1（逐实例）'; } catch (err) { divisorOk = `异常:${err.message}`; }
      let drawOk = '(未执行)';
      try { gl.drawArraysInstanced(gl.TRIANGLES, 0, 1, 100); drawOk = '成功：drawArraysInstanced(TRIANGLES, 0, 1, 100)'; } catch (err) { drawOk = `异常:${err.message}`; }
      try { gl.bindVertexArray(null); } catch { /* noop */ }
      const isVao2 = gl.isVertexArray(vao);
      this.setState({ vaoInfo: L([
        'VAO 与实例化渲染演示：',
        'gl.createVertexArray() → WebGLVertexArrayObject ✓',
        `  gl.bindVertexArray(vao) 后所有 vertexAttribPointer / enableVertexAttribArray 都记入此 VAO`,
        `  gl.isVertexArray(vao)：绑定后=${isVao1}，解绑后=${isVao2}`,
        '绑定两个属性：position buffer（逐顶点）+ offset buffer（逐实例）',
        `gl.vertexAttribDivisor：${divisorOk}`,
        '  divisor=0 普通逐顶点（默认）；divisor=1 每实例推进一次（per-instance 数据如 transform）；divisor=N 每 N 实例推进',
        `gl.drawArraysInstanced(gl.TRIANGLES, 0, 1, 100)：${drawOk}`,
        '  gl.drawElementsInstanced(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, offset, instanceCount) 同理',
        'gl.deleteVertexArray(vao) 释放；gl.isVertexArray(vao) 判活。',
        '收益：VAO 让切换几何只需一次 bindVertexArray；实例化渲染一次 draw 绘制 N 个实例（如 1000 棵树），大幅减少 draw call。',
        '说明：WebGL2 内置 VAO 与实例化（WebGL1 需扩展）。',
      ]) });
      this._addLog('vao', `VAO 演示完成：divisor ${divisorOk.startsWith('成功') ? '✓' : '✗'}，drawArraysInstanced ${drawOk.startsWith('成功') ? '✓' : '✗'}`);
    } catch (err) { this._addLog('warn', `VAO 演示失败：${err.name} - ${err.message}`); }
  }

  _renderCard4() {
    const s = this.state; const caps = this._caps();
    const card = new Card({
      title: '4. VAO 顶点数组对象与实例化渲染（createVertexArray / drawArraysInstanced / vertexAttribDivisor）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.createVertexArray ? 'success' : 'error' }, caps.createVertexArray ? 'VAO ✓' : 'VAO ✗'),
        h(Tag, { color: 'primary' }, '一次 draw 绘 N 实例')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'gl.createVertexArray() 创建 WebGLVertexArrayObject，gl.bindVertexArray(vao) 封装所有顶点属性绑定 + buffer 指针（之后切换几何只需一次 bind），gl.deleteVertexArray / gl.isVertexArray。实例化渲染：gl.drawArraysInstanced(mode, first, count, instanceCount) / gl.drawElementsInstanced(mode, count, type, offset, instanceCount)。gl.vertexAttribDivisor(index, divisor) 控制属性推进频率：divisor=0 普通逐顶点（默认），divisor=1 每实例推进一次（per-instance 数据如 transform），divisor=N 每 N 实例推进。用途：一次 draw 渲染 1000 棵树。WebGL2 内置 VAO 与实例化（WebGL1 需扩展）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 VAO + 实例化', { type: 'primary', size: 'sm', disabled: !caps.webgl2, onClick: () => this._demoVAOInstanced() })),
        h('div', { class: 'fs-sm text-secondary' }, 'VAO 与实例化渲染演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.vaoInfo || '（点击「创建 VAO + 实例化」开始演示）')),
        h(Alert, { type: 'info', message: 'VAO + 实例化是减少 draw call 的关键',
          description: 'VAO 把属性绑定状态打包，切换几何从多次 bindBuffer+vertexAttribPointer 降为一次 bindVertexArray。实例化渲染把 N 个相同几何的绘制合并为一次 drawArraysInstanced，per-instance 数据（位置/颜色/变换矩阵）通过 divisor=1 的实例化属性提供。两者结合可极大降低 CPU 开销。' }),
      ],
    });
    this.registerChild(card); return card.render();
  }

  // =================== Card 5：3D 纹理与多重采样 ===================

  _demo3DTextures() {
    const caps = this._caps();
    if (!caps.texImage3D || !caps.renderbufferStorageMultisample) {
      this.setState({ tex3dInfo: L([
        '3D 纹理与多重采样用法（当前环境不可用，仅说明）：',
        '// ===== 3D 纹理（WebGL2 新增，WebGL1 无）=====',
        'const tex3d = gl.createTexture();',
        'gl.bindTexture(gl.TEXTURE_3D, tex3d);            // 或 gl.TEXTURE_2D_ARRAY',
        'gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8,           // target, level, internalformat',
        '  8, 8, 8, 0,                                    // width, height, depth, border',
        '  gl.RED_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array(8*8*8));  // format, type, srcData',
        'gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R8, 8, 8, 8);  // 不可变存储（一次性分配所有 level）',
        '// 更新子区域：gl.texSubImage3D(...)',
        '// GLSL 采样：uniform sampler3D uVol; float v = texture(uVol, vec3(u,v,w)).r;  // 第三维为深度切片',
        '用途：体积数据（医学 CT/MRI）、3D 查找表、按深度切片做动画。',
        '// ===== 多重采样（MSAA FBO，WebGL2 新增）=====',
        'gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);',
        'const msaaFBO = gl.createFramebuffer();',
        'gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msaaRB);',
        '// 渲染到 msaaFBO，再用 blitFramebuffer resolve 到普通 FBO',
        'gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaaFBO); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, resolveFBO);',
        'gl.blitFramebuffer(0,0,w,h, 0,0,w,h, gl.COLOR_BUFFER_BIT, gl.LINEAR);',
        'gl.sampleCoverage(value, invert);  // value∈[0,1]，控制覆盖率',
        'const maxSamples = gl.getParameter(gl.MAX_SAMPLES);  // 最大采样数',
        '说明：WebGL1 无 3D 纹理、无 MSAA FBO（仅 canvas 级 antialias）；WebGL2 内置两者。',
      ]) });
      this._addLog('warn', 'texImage3D/renderbufferStorageMultisample 不可用（mock 无此方法），已记录 3D 纹理 + MSAA 用法');
      return;
    }
    const gl = this._ensureGL(); if (!gl) return;
    try {
      this._addLog('tex3d', 'createTexture() + texImage3D → 创建 3D 噪声纹理…');
      const tex = gl.createTexture(); this._textures.push(tex);
      try { gl.bindTexture(gl.TEXTURE_3D, tex); } catch { /* noop */ }
      const W = 8, H = 8, D = 8;
      const data = new Uint8Array(W * H * D);
      for (let i = 0; i < data.length; i++) data[i] = (i * 31) & 0xff;
      let texOk = '(未执行)';
      try { gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, W, H, D, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data); texOk = `成功：texImage3D(TEXTURE_3D, 0, R8, ${W}×${H}×${D}, 0, RED_INTEGER, UNSIGNED_BYTE, data)`; } catch (err) { texOk = `异常:${err.message}`; }
      let storageOk = '(未执行)';
      try { gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R8, W, H, D); storageOk = '成功'; } catch (err) { storageOk = `异常:${err.message}`; }
      const msaaRB = gl.createRenderbuffer(); this._buffers.push(msaaRB);
      try { gl.bindRenderbuffer(gl.RENDERBUFFER, msaaRB); } catch { /* noop */ }
      let msaaOk = '(未执行)';
      try { gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, gl.RGBA8, 64, 64); msaaOk = '成功：samples=4, RGBA8, 64×64'; } catch (err) { msaaOk = `异常:${err.message}`; }
      let blitOk = '(未执行)';
      try { gl.blitFramebuffer(0, 0, 64, 64, 0, 0, 64, 64, gl.COLOR_BUFFER_BIT, gl.LINEAR); blitOk = '成功'; } catch (err) { blitOk = `异常:${err.message}`; }
      let covOk = '(未执行)', maxSamples = '(不可查)';
      try { gl.sampleCoverage(0.5, false); covOk = '成功：sampleCoverage(0.5, false)'; } catch (err) { covOk = `异常:${err.message}`; }
      try { maxSamples = String(gl.getParameter(gl.MAX_SAMPLES)); } catch { /* noop */ }
      this.setState({ tex3dInfo: L([
        '3D 纹理与多重采样演示：',
        '===== 3D 纹理 =====',
        'gl.createTexture() + gl.bindTexture(gl.TEXTURE_3D, tex) ✓',
        `gl.texImage3D：${texOk}`,
        '  target ∈ gl.TEXTURE_3D | gl.TEXTURE_2D_ARRAY；参数：target, level, internalformat, w, h, depth, border, format, type, srcData',
        `gl.texStorage3D(不可变存储)：${storageOk}；参数：target, levels, internalformat, w, h, depth`,
        'GLSL 采样：uniform sampler3D uVol; float v = texture(uVol, vec3(u,v,w)).r;（第三维 w 为深度切片，可动画化）',
        '===== 多重采样 MSAA FBO =====',
        `gl.renderbufferStorageMultisample：${msaaOk}；参数：target(gl.RENDERBUFFER), samples, internalformat, w, h`,
        `gl.blitFramebuffer：${blitOk}；参数：srcX0..srcY1, dstX0..dstY1, mask, filter（READ_FRAMEBUFFER→DRAW_FRAMEBUFFER resolve 降采样）`,
        `gl.sampleCoverage：${covOk}`,
        `gl.getParameter(gl.MAX_SAMPLES) → ${maxSamples}`,
        'WebGL1 vs WebGL2：WebGL1 无 3D 纹理、无 MSAA FBO（仅 canvas 级 antialias）；WebGL2 内置两者。',
      ]) });
      this._addLog('tex3d', `3D 纹理 + MSAA 演示完成：texImage3D ${texOk.startsWith('成功') ? '✓' : '✗'}，MSAA ${msaaOk.startsWith('成功') ? '✓' : '✗'}`);
    } catch (err) { this._addLog('warn', `3D 纹理 + MSAA 演示失败：${err.name} - ${err.message}`); }
  }

  _renderCard5() {
    const s = this.state; const caps = this._caps();
    const card = new Card({
      title: '5. 3D 纹理与多重采样（texImage3D / texStorage3D / renderbufferStorageMultisample / blitFramebuffer）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.texImage3D ? 'success' : 'error' }, caps.texImage3D ? 'texImage3D ✓' : 'texImage3D ✗'),
        h(Tag, { color: caps.renderbufferStorageMultisample ? 'success' : 'error' }, caps.renderbufferStorageMultisample ? 'MSAA ✓' : 'MSAA ✗'),
        h(Tag, { color: 'primary' }, '体积 / 抗锯齿')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '3D 纹理：gl.texImage3D(target, level, internalformat, w, h, depth, border, format, type, srcData)，target ∈ gl.TEXTURE_3D | gl.TEXTURE_2D_ARRAY；gl.texStorage3D(target, levels, internalformat, w, h, depth) 不可变存储。GLSL 用 sampler3D + texture(sampler, vec3(uvw))（第三维为深度切片）。用途：体积数据、3D 查找表、按切片动画。多重采样：gl.renderbufferStorageMultisample(target, samples, internalformat, w, h) 创建 MSAA renderbuffer，渲染到 MSAA FBO 后用 gl.blitFramebuffer(src..., dst..., mask, filter) resolve 降采样；gl.sampleCoverage(value, invert) 控制覆盖率；gl.getParameter(gl.MAX_SAMPLES) 查最大采样数。WebGL2 内置（WebGL1 无 3D 纹理与 MSAA FBO）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 3D 纹理 + MSAA', { type: 'primary', size: 'sm', disabled: !caps.webgl2, onClick: () => this._demo3DTextures() })),
        h('div', { class: 'fs-sm text-secondary' }, '3D 纹理与多重采样演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.tex3dInfo || '（点击「创建 3D 纹理 + MSAA」开始演示）')),
        h(Alert, { type: 'info', message: 'WebGL2 新增 3D 纹理与 MSAA FBO',
          description: 'WebGL1 仅支持 2D 纹理与 canvas 级 antialias（无法自定义采样数）。WebGL2 的 texImage3D 支持体积纹理与 2D 数组纹理；renderbufferStorageMultisample + blitFramebuffer 实现 MSAA 离屏渲染（可控制 samples 数量，resolve 后得到抗锯齿结果）。TEXTURE_2D_ARRAY 与 TEXTURE_3D 都用 texImage3D，区别在采样语义（数组按切片整数索引、3D 按浮点插值）。' }),
      ],
    });
    this.registerChild(card); return card.render();
  }

  // =================== Card 6：Uniform Buffer Objects 与扩展 ===================

  _demoUBOAndExts() {
    const caps = this._caps();
    if (!caps.bindBufferBase || !caps.uniformBlockBinding || !caps.getSupportedExtensions) {
      this.setState({ uboInfo: L([
        'UBO 与扩展用法（当前环境不可用，仅说明）：',
        '// ===== Uniform Buffer Objects（UBO）=====',
        '// GLSL ES 3.00：layout(std140) uniform Block { mat4 uMVP; vec3 uLight; float uTime; };',
        '//   std140 陷阱：vec3 填充为 vec4 占 16B；结构体按 16B 对齐；vec3 后的 float 需偏移到下一 16B 边界',
        'const ubo = gl.createBuffer();',
        'gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);',
        'gl.bufferData(gl.UNIFORM_BUFFER, new ArrayBuffer(256), gl.DYNAMIC_DRAW);',
        'gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);             // 绑定到 binding=0',
        '// 或 gl.bindBufferRange(UNIFORM_BUFFER, 0, ubo, offset, size) —— 绑定子区域',
        'const blockIndex = gl.getUniformBlockIndex(prog, "Scene");',
        'gl.uniformBlockBinding(prog, blockIndex, 0);             // Scene → binding 0',
        'gl.getActiveUniformBlockParameter(prog, blockIndex, gl.UNIFORM_BLOCK_DATA_SIZE);  // block 字节数',
        '// 收益：多个 program 共享同一 UBO（如相机矩阵），更新一次所有 program 受益。',
        '// ===== 其他 WebGL2 特性 =====',
        'gl.texStorage2D(gl.TEXTURE_2D, levels, internalformat, w, h);  // 不可变 2D 存储（3D 用 texStorage3D）',
        'gl.copyBufferSubData(readTarget, writeTarget, readOff, writeOff, size);  // GPU 内 buffer 拷贝',
        'gl.getBufferSubData(target, offset, dstData);                  // buffer 读回 CPU（异步，需 Sync）',
        'gl.texSubImage3D(...);                                         // 更新 3D 纹理子区域',
        '// Sampler 对象（解耦纹理参数与纹理对象）',
        'const sampler = gl.createSampler(); gl.bindSampler(unit, sampler);',
        'gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR);',
        '// ===== 扩展查询 =====',
        'const exts = gl.getSupportedExtensions();  // ["EXT_color_buffer_float", ...]',
        'gl.getExtension("EXT_color_buffer_float");      // 浮点颜色缓冲',
        'gl.getExtension("WEBGL_compressed_texture_s3tc"); // S3TC 压缩纹理',
        'gl.getExtension("OES_texture_float_linear");     // 浮点纹理线性过滤',
      ]) });
      this._addLog('warn', 'UBO/扩展方法不可用（mock 无此方法），已记录 UBO + 扩展用法');
      return;
    }
    const gl = this._gl;
    try {
      this._addLog('ubo', 'createBuffer() + bindBuffer(UNIFORM_BUFFER) → 创建 UBO…');
      const ubo = gl.createBuffer(); this._buffers.push(ubo);
      try { gl.bindBuffer(gl.UNIFORM_BUFFER, ubo); } catch { /* noop */ }
      try { gl.bufferData(gl.UNIFORM_BUFFER, new ArrayBuffer(64), gl.DYNAMIC_DRAW); } catch { /* noop */ }
      let bindBaseOk = '(未执行)';
      try { gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo); bindBaseOk = '成功：bindBufferBase(UNIFORM_BUFFER, 0, ubo)'; } catch (err) { bindBaseOk = `异常:${err.message}`; }
      let extCount = 0, extPreview = [];
      try { const exts = gl.getSupportedExtensions() || []; extCount = exts.length; extPreview = exts.slice(0, 6); } catch { /* noop */ }
      const probeExts = ['EXT_color_buffer_float', 'WEBGL_compressed_texture_s3tc', 'OES_texture_float_linear'];
      const extResults = probeExts.map((n) => { let ok = false; try { ok = !!gl.getExtension(n); } catch { /* noop */ } return `${n}: ${ok ? '可用' : '不可用'}`; });
      let samplerOk = '(未执行)';
      try {
        const sampler = gl.createSampler(); this._samplers.push(sampler);
        gl.bindSampler(0, sampler); gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        samplerOk = '成功：createSampler + bindSampler(0) + samplerParameteri(LINEAR)';
      } catch (err) { samplerOk = `异常:${err.message}`; }
      this.setState({ uboInfo: L([
        'UBO 与扩展演示：',
        '===== Uniform Buffer Objects =====',
        'gl.createBuffer() + gl.bindBuffer(gl.UNIFORM_BUFFER, ubo) + bufferData ✓',
        `gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo)：${bindBaseOk}`,
        '  另：gl.bindBufferRange(UNIFORM_BUFFER, index, buf, offset, size) 绑定子区域',
        'gl.uniformBlockBinding(prog, blockIndex, blockBinding) —— 关联 block 到 binding point',
        'gl.getUniformBlockIndex(prog, "Scene") —— 取 block 索引（INVALID_INDEX 表示不存在）',
        'gl.getActiveUniformBlockParameter(prog, blockIndex, pname) —— pname ∈ UNIFORM_BLOCK_DATA_SIZE 等',
        'GLSL：layout(std140) uniform Block { mat4 uMVP; vec3 uLight; float uTime; };',
        '  std140 陷阱：vec3 填充为 vec4 占 16B；结构体/数组按 16B 对齐；vec3 后的 float 需偏移到下一 16B 边界',
        '  收益：多 program 共享 UBO（如相机矩阵），更新一次所有 program 受益',
        '===== 扩展查询 =====',
        `gl.getSupportedExtensions() → ${extCount} 个扩展（预览：${extPreview.join(', ')}${extCount > 6 ? ' ...' : ''}）`,
        '关键扩展探测：',
        ...extResults.map((r) => `  • ${r}`),
        '===== Sampler 对象 =====',
        samplerOk,
        '  gl.createSampler() / gl.bindSampler(unit, sampler) / gl.samplerParameteri|f(...)（解耦纹理参数与纹理对象）',
        '===== 其他 WebGL2 特性 =====',
        '  gl.texStorage2D/3D —— 不可变存储（一次性分配所有 level）',
        '  gl.copyBufferSubData(readTarget, writeTarget, ...) —— GPU 内 buffer 拷贝',
        '  gl.getBufferSubData(target, offset, dstData) —— buffer 读回 CPU（需 Sync 同步）',
        '  gl.texSubImage3D(...) —— 更新 3D 纹理子区域',
      ]) });
      this._addLog('ubo', `UBO + 扩展演示完成：bindBufferBase ${bindBaseOk.startsWith('成功') ? '✓' : '✗'}，扩展 ${extCount} 个，sampler ${samplerOk.startsWith('成功') ? '✓' : '✗'}`);
    } catch (err) { this._addLog('warn', `UBO/扩展演示失败：${err.name} - ${err.message}`); }
  }

  _renderCard6() {
    const s = this.state; const caps = this._caps();
    const card = new Card({
      title: '6. Uniform Buffer Objects 与扩展（bindBufferBase / uniformBlockBinding / std140 / getSupportedExtensions）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.bindBufferBase ? 'success' : 'error' }, caps.bindBufferBase ? 'UBO ✓' : 'UBO ✗'),
        h(Tag, { color: caps.getSupportedExtensions ? 'success' : 'error' }, caps.getSupportedExtensions ? '扩展 ✓' : '扩展 ✗'),
        h(Tag, { color: 'primary' }, 'std140 / Sampler')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'UBO：gl.createBuffer() + gl.bindBuffer(gl.UNIFORM_BUFFER, buf) + bufferData；gl.bindBufferBase(gl.UNIFORM_BUFFER, index, buf) 或 bindBufferRange(UNIFORM_BUFFER, index, buf, offset, size) 绑定到 binding point；gl.uniformBlockBinding(program, blockIndex, blockBinding) 关联 program 的 block 到 binding；gl.getUniformBlockIndex(program, blockName) 取 block 索引；gl.getActiveUniformBlockParameter(program, blockIndex, pname) 查 block 属性。GLSL：layout(std140) uniform Block { ... }（收益：多 program 共享 uniform，更新一次）。std140 布局陷阱：vec3 填充为 vec4、结构体按 16B 对齐。其他：texStorage2D/3D（不可变存储）、copyBufferSubData（GPU 内拷贝）、getBufferSubData（读回 CPU）、texSubImage3D、createSampler/bindSampler/samplerParameteri（解耦采样参数）。扩展：getSupportedExtensions()、getExtension（EXT_color_buffer_float / WEBGL_compressed_texture_s3tc / OES_texture_float_linear）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 UBO + 查询扩展', { type: 'primary', size: 'sm', disabled: !caps.webgl2, onClick: () => this._demoUBOAndExts() })),
        h('div', { class: 'fs-sm text-secondary' }, 'UBO 与扩展演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.uboInfo || '（点击「创建 UBO + 查询扩展」开始演示）')),
        h(Alert, { type: 'warning', message: 'std140 布局对齐是 UBO 的常见陷阱',
          description: 'std140 规则：标量按自身大小对齐；vec3 视为 vec4 占 16B；结构体起始对齐到最大成员对齐（通常 16B）；数组每元素占 16B（非紧密）。手动计算 offset 易错，建议用 gl.getActiveUniformBlockParameter(prog, idx, UNIFORM_BLOCK_ACTIVE_UNIFORM_OFFSETS) 查询实际偏移。UBO 的收益是跨 program 共享（如相机矩阵只需更新一次）。' }),
      ],
    });
    this.registerChild(card); return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content))),
    );
  }

  // =================== 整页渲染 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page webgl-advanced-page' },
      h('h2', { class: 'section-title' }, 'WebGL2 高级特性 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'WebGL2 在 WebGL1 基础上新增 Sync/Query/TransformFeedback/VAO（内置）/3D 纹理/MSAA FBO/UBO/Sampler 等高级特性。本页深入演示这些 AdvancedGraphicsPage 未覆盖的深度特性（基础 context/着色器见该页）。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(), this._renderCard2(), this._renderCard3(),
      this._renderCard4(), this._renderCard5(), this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
