// =====================================================================
// WebAssemblyPage.js —— WebAssembly 实验室
// 演示 MDN：
//   1. WebAssembly.validate / compile / instantiate / instantiateStreaming /
//      Module.exports / Module.imports —— 模块编译与实例化、字节码内省
//   2. WebAssembly.Memory —— 线性内存（每页 64KB）、buffer、grow、shared
//   3. WebAssembly.Table —— 函数引用表（anyfunc/funcref/externref）、get/set/grow
//   4. WebAssembly.Global —— 全局变量（i32/i64/f32/f64）、mutable、value/valueOf
//   5. WASM 与 JS 互操作 + 异常处理 —— importObject / instance.exports /
//      RuntimeError / CompileError / LinkError / Exception / Tag
// 说明：WebAssembly（WASM）让 C/C++/Rust 等编译产物在浏览器中近原生速度运行。
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常。jsdom/Node 中 WebAssembly 为全局内置，所有 API 真实可用。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// 最小有效 wasm 模块字节：仅 magic + version，无任何段（validate 为 true）
// magic = "\0asm" = 0x00 0x61 0x73 0x6d；version = 1（小端 4 字节）
const MINIMAL_WASM_BYTES = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

// 真实可执行的 adder 模块：
// (module (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add))
const ADDER_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,            // 魔术数 + 版本
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,      // type 段：(i32,i32)->i32
  0x03, 0x02, 0x01, 0x00,                                      // function 段：函数 0 → 类型 0
  0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,       // export 段：导出 "add" → 函数 0
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b, // code 段：local.get0 local.get1 i32.add end
]);

// trap 模块：(module (func (export "trap") unreachable)) —— 调用即抛 RuntimeError
const TRAP_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,            // 魔术数 + 版本
  0x01, 0x04, 0x01, 0x60, 0x00, 0x00,                          // type 段：() -> ()
  0x03, 0x02, 0x01, 0x00,                                      // function 段：函数 0 → 类型 0
  0x07, 0x08, 0x01, 0x04, 0x74, 0x72, 0x61, 0x70, 0x00, 0x00, // export 段：导出 "trap" → 函数 0
  0x0a, 0x05, 0x01, 0x03, 0x00, 0x00, 0x0b,                    // code 段：unreachable end
]);

// import 模块：(module (import "env" "log" (func (param i32))) (func (export "run") i32.const 42 call 0))
// 调用 run() 会通过 importObject 调用 JS 的 env.log(42) —— 真实的 WASM→JS 互操作
const IMPORT_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,            // 魔术数 + 版本
  0x01, 0x08, 0x02, 0x60, 0x01, 0x7f, 0x00, 0x60, 0x00, 0x00, // type 段：(i32)->() 与 () -> ()
  0x02, 0x0b, 0x01, 0x03, 0x65, 0x6e, 0x76, 0x03, 0x6c, 0x6f, 0x67, 0x00, 0x00, // import 段：env.log (func, type 0)
  0x03, 0x02, 0x01, 0x01,                                      // function 段：函数 1 → 类型 1
  0x07, 0x07, 0x01, 0x03, 0x72, 0x75, 0x6e, 0x00, 0x01,       // export 段：导出 "run" → 函数 1
  0x0a, 0x08, 0x01, 0x06, 0x00, 0x41, 0x2a, 0x10, 0x00, 0x0b, // code 段：i32.const 42 call 0 end
]);

// 非法字节：magic 正确但段 id 非法（0xff），compile 时抛 CompileError
const BAD_BYTES = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0xff, 0xff]);

export class WebAssemblyPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：模块编译与实例化
      moduleInfo: '',
      // Card 2：Memory + grow
      memorySize: '',
      // Card 3：Table
      tableInfo: '',
      // Card 4：Global
      globalValue: '',
      // Card 5：互操作 + 异常处理
      runtimeResult: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._module = null;        // Card 1 编译得到的 WebAssembly.Module
    this._instance = null;      // Card 1 实例化得到的 instance
    this._memory = null;        // Card 2 WebAssembly.Memory
    this._table = null;         // Card 3 WebAssembly.Table
    this._global = null;        // Card 4 WebAssembly.Global
    this._importInstance = null;// Card 5 互操作实例

    // 一次性能力检测：WebAssembly 全家桶
    const hasWasm = typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module !== 'undefined';
    const hasMemory = typeof WebAssembly !== 'undefined' && typeof WebAssembly.Memory !== 'undefined';
    const hasTable = typeof WebAssembly !== 'undefined' && typeof WebAssembly.Table !== 'undefined';
    const hasGlobal = typeof WebAssembly !== 'undefined' && typeof WebAssembly.Global !== 'undefined';
    const hasStreaming = typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiateStreaming === 'function';
    const hasException = typeof WebAssembly !== 'undefined' && typeof WebAssembly.Exception !== 'undefined';
    const hasTag = typeof WebAssembly !== 'undefined' && typeof WebAssembly.Tag !== 'undefined';

    const parts = [];
    parts.push(`WebAssembly ${hasWasm ? '✓' : '✗'}`);
    parts.push(`Memory ${hasMemory ? '✓' : '✗'}`);
    parts.push(`Table ${hasTable ? '✓' : '✗'}`);
    parts.push(`Global ${hasGlobal ? '✓' : '✗'}`);
    parts.push(`instantiateStreaming ${hasStreaming ? '✓' : '✗'}`);
    parts.push(`Exception ${hasException ? '✓' : '✗'}`);
    parts.push(`Tag ${hasTag ? '✓' : '✗'}`);

    const summary = hasWasm
      ? `WebAssembly 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）WebAssembly 为全局内置，Module / Memory / Table / Global 等均真实可用，可执行真实的 adder / trap / import 模块字节。`
      : '当前环境不支持 WebAssembly（typeof WebAssembly === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(hasWasm ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasStreaming) this._addLog('warn', 'WebAssembly.instantiateStreaming 不可用（需 http(s) 且响应 Content-Type: application/wasm）');
    if (!hasException) this._addLog('warn', 'WebAssembly.Exception 不可用（需 wasm exceptions proposal 支持）');
    if (!hasTag) this._addLog('warn', 'WebAssembly.Tag 不可用（需 wasm exceptions proposal 支持）');
  }

  componentWillUnmount() {
    // 释放 WebAssembly.Module / Instance / Memory / Table / Global 引用，便于 GC
    // WebAssembly 没有显式的 dispose API，置空引用让引擎回收
    this._module = null;
    this._instance = null;
    this._memory = null;
    this._table = null;
    this._global = null;
    this._importInstance = null;
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
    const has = (n) => typeof WebAssembly !== 'undefined' && typeof WebAssembly[n] !== 'undefined';
    return {
      wasm: has('Module'),
      memory: has('Memory'),
      table: has('Table'),
      global: has('Global'),
      streaming: typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiateStreaming === 'function',
      exception: has('Exception'),
      tag: has('Tag'),
      fetch: typeof fetch === 'function',
    };
  }

  // =================== Card 1：模块编译与实例化 ===================

  // WebAssembly.validate(bufferSource) → boolean：仅校验字节码合法性，不实例化
  _validateBytes() {
    if (!this._caps().wasm || typeof WebAssembly.validate !== 'function') {
      this._addLog('warn', 'WebAssembly.validate 不可用');
      return;
    }
    try {
      const validMinimal = WebAssembly.validate(MINIMAL_WASM_BYTES);
      const validAdder = WebAssembly.validate(ADDER_BYTES);
      const validBad = WebAssembly.validate(BAD_BYTES);
      const onlyMagic = WebAssembly.validate(new Uint8Array([0x00, 0x61, 0x73, 0x6d]));
      this.setState({
        moduleInfo:
          `WebAssembly.validate(bufferSource) → boolean（仅校验，不实例化）\n` +
          `validate(最小模块, 8B) = ${validMinimal}（仅 magic+version，无段）\n` +
          `validate(adder 模块, ${ADDER_BYTES.length}B) = ${validAdder}（含 type/func/export/code 段）\n` +
          `validate(非法字节 [..0xff 0xff], ${BAD_BYTES.length}B) = ${validBad}（段 id 非法）\n` +
          `validate(仅 magic 4 字节, 4B) = ${onlyMagic}（缺 version，不完整）`,
      });
      this._addLog('validate', `validate：最小=${validMinimal}，adder=${validAdder}，非法=${validBad}，仅magic=${onlyMagic}`);
    } catch (err) {
      this._addLog('warn', `validate 抛错：${err.name} - ${err.message}`);
    }
  }

  // WebAssembly.compile(bufferSource) → Promise<WebAssembly.Module>
  // WebAssembly.Module.exports(module) / Module.imports(module) → 内省导出/导入
  async _compileModule() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly.compile 不可用');
      return;
    }
    try {
      this._addLog('compile', '开始 WebAssembly.compile(ADDER_BYTES)…');
      const module = await WebAssembly.compile(ADDER_BYTES);   // → Promise<WebAssembly.Module>
      this._module = module;
      const exportsMeta = WebAssembly.Module.exports(module);  // [{ name, kind }]
      const importsMeta = WebAssembly.Module.imports(module);  // []（adder 无导入）
      const exportsText = exportsMeta.map((e) => `• ${e.name}（kind: ${e.kind}）`).join('\n');
      const importsText = importsMeta.length
        ? importsMeta.map((i) => `• ${i.module}.${i.name}（kind: ${i.kind}）`).join('\n')
        : '（无导入）';
      this.setState({
        moduleInfo:
          `WebAssembly.compile(ADDER_BYTES) → WebAssembly.Module ✓\n` +
          `Module.exports(module) = ${JSON.stringify(exportsMeta)}\n` +
          `Module.imports(module) = ${JSON.stringify(importsMeta)}\n\n` +
          `导出接口：\n${exportsText}\n\n` +
          `导入需求：\n${importsText}\n\n` +
          `说明：exports/imports 返回 { name, kind }，kind ∈ 'function'/'memory'/'table'/'global'`,
      });
      this._addLog('compile', `编译成功：exports=${JSON.stringify(exportsMeta)}，imports=${importsMeta.length} 项`);
    } catch (err) {
      this._addLog('warn', `compile 失败：${err.name} - ${err.message}`);
    }
  }

  // WebAssembly.instantiate(bufferSource, importObject) → Promise<{ module, instance }>
  // WebAssembly.instantiateStreaming(fetch(url), importObject) → Promise<{ module, instance }>
  async _instantiateModule() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly.instantiate 不可用');
      return;
    }
    try {
      this._addLog('instance', '开始 WebAssembly.instantiate(ADDER_BYTES, {})…');
      const { module, instance } = await WebAssembly.instantiate(ADDER_BYTES, {}); // importObject = {}
      this._module = module;
      this._instance = instance;
      const r1 = instance.exports.add(2, 3);
      const r2 = instance.exports.add(40, 2);
      let streamLine = '';
      // 演示 instantiateStreaming：用 mock fetch 返回 Response（Content-Type: application/wasm）
      if (this._caps().streaming && this._caps().fetch) {
        try {
          const resp = new Response(ADDER_BYTES, { headers: { 'Content-Type': 'application/wasm' } });
          const { instance: streamInst } = await WebAssembly.instantiateStreaming(Promise.resolve(resp), {});
          const r3 = streamInst.exports.add(7, 8);
          streamLine = `\ninstantiateStreaming(mock fetch, ${ADDER_BYTES.length}B) → { module, instance } ✓\n` +
            `  instance.exports.add(7, 8) = ${r3}（响应 Content-Type 必须为 application/wasm）`;
          this._addLog('instance', `instantiateStreaming 成功：add(7,8)=${r3}`);
        } catch (err) {
          streamLine = `\ninstantiateStreaming 失败：${err.name} - ${err.message}`;
          this._addLog('warn', `instantiateStreaming 失败：${err.message}`);
        }
      } else {
        streamLine = '\ninstantiateStreaming 不可用（需 fetch + http(s) 环境）';
      }
      this.setState({
        moduleInfo:
          `WebAssembly.instantiate(ADDER_BYTES, {}) → { module, instance } ✓\n` +
          `instance.exports.add(2, 3) = ${r1}\n` +
          `instance.exports.add(40, 2) = ${r2}${streamLine}`,
      });
      this._addLog('instance', `实例化成功：add(2,3)=${r1}, add(40,2)=${r2}`);
    } catch (err) {
      this._addLog('warn', `instantiate 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. WebAssembly 模块编译与实例化',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.wasm ? 'success' : 'error' }, caps.wasm ? 'WebAssembly ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'compile / instantiate'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'WebAssembly.validate(bufferSource) → boolean 验证字节码合法性；compile(bufferSource) → Promise<Module>；instantiate(bufferSource, importObject) → Promise<{module, instance}>；instantiateStreaming(fetch(url), importObject) 流式编译（响应必须是 application/wasm MIME 类型）。Module.exports(module) / Module.imports(module) 返回导出/导入描述 { name, kind }，kind ∈ function/memory/table/global。本卡片用最小的 WAT 文本对应的二进制（adder 模块）演示编译流程。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('validate', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._validateBytes() }),
          this._btn('compile', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._compileModule() }),
          this._btn('instantiate', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._instantiateModule() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '编译 / 实例化 / 内省结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.moduleInfo || '（点击 validate / compile / instantiate）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'adder 模块对应的 WAT 文本与字节布局：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`; (module (func (export "add") (param i32 i32) (result i32)
;              local.get 0 local.get 1 i32.add))
00 61 73 6d 01 00 00 00   ; magic "\\0asm" + version 1
01 07 01 60 02 7f 7f 01 7f ; type: (i32,i32)->i32
03 02 01 00               ; function: func 0 -> type 0
07 07 01 03 61 64 64 00 00; export "add" -> func 0
0a 09 01 07 00 20 00 20 01 6a 0b ; code: local.get 0/1, i32.add, end`)),
        h(Alert, {
          type: 'info',
          message: 'instantiateStreaming 比 instantiate 更高效',
          description: 'streaming 直接流式消费 Response，省一次 ArrayBuffer 拷贝；但要求响应 Content-Type 为 application/wasm，否则抛 TypeError。本演示用 mock fetch（new Response(bytes, { headers })）模拟。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Memory + grow ===================

  // new WebAssembly.Memory({ initial, maximum, shared }) → memory
  _createMemory() {
    if (!this._caps().memory) {
      this._addLog('warn', 'WebAssembly.Memory 不可用');
      return;
    }
    try {
      const memory = new WebAssembly.Memory({ initial: 1, maximum: 10, shared: false });
      this._memory = memory;
      const len = memory.buffer.byteLength;
      const pages = len / 65536;
      this.setState({
        memorySize:
          `new WebAssembly.Memory({ initial: 1, maximum: 10, shared: false })\n` +
          `memory.buffer → ArrayBuffer，byteLength = ${len}（${pages} 页 × 64KB）\n` +
          `说明：每页固定 64KB（65536 字节）；maximum 为上限页数；shared: true 需要 crossOriginIsolated 环境。`,
      });
      this._addLog('memory', `已创建 Memory：buffer.byteLength=${len}（${pages} 页），maximum=10 页`);
    } catch (err) {
      this._addLog('warn', `创建 Memory 失败：${err.name} - ${err.message}`);
    }
  }

  // memory.grow(delta) → 返回之前的页数；grow 后 buffer 引用变为新的更大 ArrayBuffer（旧引用作废）
  _growMemory() {
    if (!this._caps().memory) {
      this._addLog('warn', 'WebAssembly.Memory 不可用');
      return;
    }
    if (!this._memory) {
      this._addLog('warn', '请先点击「创建 Memory」');
      return;
    }
    try {
      const beforeLen = this._memory.buffer.byteLength;
      const beforePages = beforeLen / 65536;
      const prevPages = this._memory.grow(2);   // grow(2) 扩容 2 页，返回之前的页数
      const afterLen = this._memory.buffer.byteLength;
      const afterPages = afterLen / 65536;
      this.setState({
        memorySize:
          `memory.grow(2) → 返回之前页数 ${prevPages}\n` +
          `grow 前：buffer.byteLength = ${beforeLen}（${beforePages} 页）\n` +
          `grow 后：buffer.byteLength = ${afterLen}（${afterPages} 页）\n` +
          `⚠ grow 后旧 ArrayBuffer 引用作废，memory.buffer 指向新的更大 ArrayBuffer。`,
      });
      this._addLog('grow', `grow(2)：${beforePages} 页 → ${afterPages} 页，返回旧页数 ${prevPages}（旧 buffer 已作废）`);
    } catch (err) {
      this._addLog('warn', `grow 失败：${err.name} - ${err.message}`);
    }
  }

  // 通过 DataView 读写 memory.buffer（演示 WASM 线性内存的 JS 读写）
  _readWriteBuffer() {
    if (!this._caps().memory) {
      this._addLog('warn', 'WebAssembly.Memory 不可用');
      return;
    }
    if (!this._memory) {
      this._addLog('warn', '请先点击「创建 Memory」');
      return;
    }
    try {
      const buf = this._memory.buffer;
      const dv = new DataView(buf, 0, 8);
      dv.setInt32(0, 0x12345678, true);   // 小端写入
      dv.setFloat64(4, 3.14159, true);
      const i32 = dv.getInt32(0, true);
      const f64 = dv.getFloat64(4, true);
      const u8 = Array.from(new Uint8Array(buf, 0, 8));
      this.setState({
        memorySize:
          `通过 DataView 读写 memory.buffer：\n` +
          `new DataView(memory.buffer, 0, 8)\n` +
          `setInt32(0, 0x12345678, true) → getInt32(0, true) = ${i32}（0x${i32.toString(16)}）\n` +
          `setFloat64(4, 3.14159, true) → getFloat64(4, true) = ${f64}\n` +
          `前 8 字节（Uint8Array）：[${u8.join(', ')}]\n` +
          `说明：WASM 线性内存是一段连续 ArrayBuffer，JS 用 DataView / TypedArray 读写。`,
      });
      this._addLog('memory', `读写 buffer：Int32=${i32}(0x${i32.toString(16)})，Float64=${f64}`);
    } catch (err) {
      this._addLog('warn', `读写 buffer 失败：${err.name} - ${err.message}（可能 grow 后引用了旧 buffer）`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. WebAssembly.Memory + grow',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.memory ? 'success' : 'error' }, caps.memory ? 'Memory ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '64KB / 页'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new WebAssembly.Memory({ initial: 1, maximum: 10, shared: false }) 创建线性内存；memory.buffer → ArrayBuffer（长度 = initial × 64KB）；memory.grow(delta) 返回之前的页数（每页 64KB），grow 后 buffer 引用会变为新的更大 ArrayBuffer（旧引用作废）。共享内存 shared: true 需要 crossOriginIsolated 环境（COOP/COEP）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 Memory', { type: 'primary', size: 'sm', disabled: !caps.memory, onClick: () => this._createMemory() }),
          this._btn('grow(扩容)', { type: 'primary', size: 'sm', disabled: !caps.memory, onClick: () => this._growMemory() }),
          this._btn('读写 buffer', { size: 'sm', disabled: !caps.memory, onClick: () => this._readWriteBuffer() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Memory 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, s.memorySize || '（点击「创建 Memory」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`const memory = new WebAssembly.Memory({ initial: 1, maximum: 10, shared: false });
const view = new Int32Array(memory.buffer); // 每页 64KB
view[0] = 42;                                // JS 写入
const prev = memory.grow(2);                 // 扩容 2 页，返回旧页数
// grow 后 memory.buffer 变为新 ArrayBuffer，旧 view 失效`)),
        h(Alert, {
          type: 'warning',
          message: 'grow 后旧 ArrayBuffer 引用作废',
          description: 'memory.grow() 会分配新的更大 ArrayBuffer 并替换 memory.buffer；之前缓存的 buffer / DataView / TypedArray 引用将失效（detached），必须重新从 memory.buffer 取。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Table ===================

  // new WebAssembly.Table({ element, initial, maximum }) → table
  _createTable() {
    if (!this._caps().table) {
      this._addLog('warn', 'WebAssembly.Table 不可用');
      return;
    }
    try {
      const table = new WebAssembly.Table({ element: 'anyfunc', initial: 2, maximum: 10 });
      this._table = table;
      this.setState({
        tableInfo:
          `new WebAssembly.Table({ element: 'anyfunc', initial: 2, maximum: 10 })\n` +
          `table.length = ${table.length}\n` +
          `table.get(0) = ${table.get(0)}（初始为 null）\n` +
          `说明：element 类型 'anyfunc'（函数引用，规范名 funcref）/ 'externref'（外部引用）。\n` +
          `用途：动态函数表，支持 call_indirect 间接调用。`,
      });
      this._addLog('table', `已创建 Table：element=anyfunc，length=${table.length}，get(0)=${table.get(0)}`);
    } catch (err) {
      this._addLog('warn', `创建 Table 失败：${err.name} - ${err.message}`);
    }
  }

  // table.set(index, value) → 设置函数引用
  _setTableFunc() {
    if (!this._caps().table) {
      this._addLog('warn', 'WebAssembly.Table 不可用');
      return;
    }
    if (!this._table) {
      this._addLog('warn', '请先点击「创建 Table」');
      return;
    }
    try {
      const fnDouble = (x) => x * 2;
      const fnInc = (x) => x + 1;
      this._table.set(0, fnDouble);
      this._table.set(1, fnInc);
      const got0 = this._table.get(0);
      const got1 = this._table.get(1);
      this.setState({
        tableInfo:
          `table.set(0, (x) => x * 2) / table.set(1, (x) => x + 1)\n` +
          `table.get(0) = ${got0 ? 'function' : 'null'}（typeof ${typeof got0}）\n` +
          `table.get(1) = ${got1 ? 'function' : 'null'}（typeof ${typeof got1}）\n` +
          `table.length = ${this._table.length}`,
      });
      this._addLog('table', `set(0, fn×2) 与 set(1, fn+1)：get(0)=${got0 ? 'function' : 'null'}，get(1)=${got1 ? 'function' : 'null'}`);
    } catch (err) {
      this._addLog('warn', `set 函数失败：${err.name} - ${err.message}`);
    }
  }

  // table.get(index) → 取出函数引用并调用（模拟 call_indirect 间接调用）
  _getTableFunc() {
    if (!this._caps().table) {
      this._addLog('warn', 'WebAssembly.Table 不可用');
      return;
    }
    if (!this._table) {
      this._addLog('warn', '请先点击「创建 Table」并「set 函数」');
      return;
    }
    try {
      const fn0 = this._table.get(0);
      const fn1 = this._table.get(1);
      const r0 = fn0 ? fn0(21) : null;
      const r1 = fn1 ? fn1(99) : null;
      const lenBefore = this._table.length;
      const prev = this._table.grow(1, null);   // grow(delta, initValue)：扩容并用 null 填充
      const lenAfter = this._table.length;
      this.setState({
        tableInfo:
          `table.get(0)(21) = ${r0}（取出 fn×2 并调用）\n` +
          `table.get(1)(99) = ${r1}（取出 fn+1 并调用）\n` +
          `table.grow(1, null) → 返回之前长度 ${prev}；length: ${lenBefore} → ${lenAfter}\n` +
          `说明：get 取出的就是 JS 函数引用，可直接调用；grow 第二参为新槽位的初值。`,
      });
      this._addLog('call', `get(0)(21)=${r0}，get(1)(99)=${r1}；grow(1,null) 后 length=${lenAfter}`);
    } catch (err) {
      this._addLog('warn', `get 函数失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. WebAssembly.Table',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.table ? 'success' : 'error' }, caps.table ? 'Table ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'anyfunc / externref'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new WebAssembly.Table({ element: "anyfunc" | "externref", initial, maximum }) 创建函数引用表；table.length 获取长度；table.get(index) 取出函数引用；table.set(index, value) 设置引用；table.grow(delta, value) 扩容。用途：动态函数表，支持 call_indirect 间接调用。element 类型：anyfunc（函数引用，规范名 funcref）/ externref（外部引用）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 Table', { type: 'primary', size: 'sm', disabled: !caps.table, onClick: () => this._createTable() }),
          this._btn('set 函数', { type: 'primary', size: 'sm', disabled: !caps.table, onClick: () => this._setTableFunc() }),
          this._btn('get 函数', { size: 'sm', disabled: !caps.table, onClick: () => this._getTableFunc() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Table 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, s.tableInfo || '（点击「创建 Table」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {},
`const table = new WebAssembly.Table({ element: 'anyfunc', initial: 2, maximum: 10 });
table.set(0, (x) => x * 2);                    // 存入函数引用
const fn = table.get(0);                        // 取出
const r = fn(21);                               // 直接调用（= 42）
const prev = table.grow(1, null);               // 扩容，新槽位用 null 填充`)),
        h(Alert, {
          type: 'info',
          message: 'Table 是间接调用的基础',
          description: 'WASM 的 call_indirect 通过 table 索引调用函数，实现函数指针 / 虚表。JS 也可直接 get 取出函数引用调用，便于在 JS 与 WASM 间传递可调用对象。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Global ===================

  // new WebAssembly.Global({ value, mutable }, initialValue) → global
  _createGlobal() {
    if (!this._caps().global) {
      this._addLog('warn', 'WebAssembly.Global 不可用');
      return;
    }
    try {
      const global = new WebAssembly.Global({ value: 'i32', mutable: true }, 42);
      this._global = global;
      const init = global.value;
      this.setState({
        globalValue:
          `new WebAssembly.Global({ value: 'i32', mutable: true }, 42)\n` +
          `global.value（初始）= ${init}\n` +
          `global.valueOf() = ${global.valueOf()}（与 .value 等价）\n` +
          `value 类型：i32 / i64 / f32 / f64 / v128 / externref\n` +
          `mutable: true 时 value 可写；false 时只读（读取仍可）。`,
      });
      this._addLog('global', `已创建 Global：value=i32, mutable=true，初始值=${init}，valueOf()=${global.valueOf()}`);
    } catch (err) {
      this._addLog('warn', `创建 Global 失败：${err.name} - ${err.message}`);
    }
  }

  // global.value / global.valueOf() → 读取全局变量
  _readGlobal() {
    if (!this._caps().global) {
      this._addLog('warn', 'WebAssembly.Global 不可用');
      return;
    }
    if (!this._global) {
      this._addLog('warn', '请先点击「创建 Global」');
      return;
    }
    try {
      const v = this._global.value;
      const vo = this._global.valueOf();
      this.setState({
        globalValue:
          `读取 Global：\n` +
          `global.value = ${v}\n` +
          `global.valueOf() = ${vo}\n` +
          `typeof global.value = ${typeof v}\n` +
          `说明：value 与 valueOf() 等价；WASM 模块导出的 Global 可被 JS 读写。`,
      });
      this._addLog('value', `读 Global：value=${v}，valueOf()=${vo}（typeof ${typeof v}）`);
    } catch (err) {
      this._addLog('warn', `读 Global 失败：${err.name} - ${err.message}`);
    }
  }

  // global.value = X → 写入全局变量（需 mutable: true）
  _writeGlobal() {
    if (!this._caps().global) {
      this._addLog('warn', 'WebAssembly.Global 不可用');
      return;
    }
    if (!this._global) {
      this._addLog('warn', '请先点击「创建 Global」');
      return;
    }
    try {
      const before = this._global.value;
      this._global.value = 100;
      const after = this._global.value;
      // 额外演示一个 mutable:false 的只读 Global
      let readonlyLine = '';
      try {
        const ro = new WebAssembly.Global({ value: 'i32', mutable: false }, 7);
        readonlyLine = `\n\n只读 Global：new Global({ value:'i32', mutable:false }, 7)\n  ro.value = ${ro.value}（只读，赋值会抛 TypeError）`;
        try { ro.value = 999; } catch (e) { readonlyLine += `\n  尝试 ro.value = 999 → ${e.name}（不可写）`; }
      } catch (e) { readonlyLine = `\n\n只读 Global 创建失败：${e.message}`; }
      this.setState({
        globalValue:
          `写入 Global（mutable: true）：\n` +
          `global.value：${before} → 赋值 100 → ${after}\n` +
          `说明：mutable:false 时 value 不可写（读取仍可）。${readonlyLine}`,
      });
      this._addLog('value', `写 Global：${before} → ${after}（mutable:true 可写）；并演示了只读 Global`);
    } catch (err) {
      this._addLog('warn', `写 Global 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. WebAssembly.Global',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.global ? 'success' : 'error' }, caps.global ? 'Global ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'i32 / i64 / f32 / f64'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new WebAssembly.Global({ value: "i32" | "i64" | "f32" | "f64", mutable: true }, initialValue) 创建全局变量；global.value 读写值；global.valueOf() 返回值（与 .value 等价）。value 类型：i32 / i64 / f32 / f64 / v128 / externref。mutable: false 时 value 不可写（读取仍可）。用途：WASM 模块导出的全局变量，可被 JS 读写。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 Global', { type: 'primary', size: 'sm', disabled: !caps.global, onClick: () => this._createGlobal() }),
          this._btn('读 value', { size: 'sm', disabled: !caps.global, onClick: () => this._readGlobal() }),
          this._btn('写 value', { type: 'primary', size: 'sm', disabled: !caps.global, onClick: () => this._writeGlobal() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Global 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, s.globalValue || '（点击「创建 Global」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {},
`const g = new WebAssembly.Global({ value: 'i32', mutable: true }, 42);
g.value = 100;                  // mutable:true 可写
g.valueOf();                    // 100（与 .value 等价）
const ro = new WebAssembly.Global({ value: 'i64', mutable: false }, 7n);
// ro.value = 9n;               // mutable:false 赋值会抛 TypeError`)),
        h(Alert, {
          type: 'info',
          message: 'Global 是 WASM 与 JS 共享的标量',
          description: 'Global 让 WASM 模块导出的全局变量（如编译期常量、计数器）可被 JS 直接读写，避免通过 Memory 间接传递。i64 类型在 JS 中以 BigInt 返回。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：互操作 + 异常处理 ===================

  // 构造 importObject，实例化 IMPORT_BYTES，调用 instance.exports.run()
  // run() 内部 i32.const 42 + call $log → 触发 JS 的 env.log(42) —— 真实 WASM→JS 互操作
  async _demoInterop() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly 不可用');
      return;
    }
    try {
      this._addLog('export', '构造 importObject = { env: { log: (n) => ... } }，实例化 IMPORT_BYTES…');
      // importObject：传入 JS 函数给 WASM 调用
      const importObject = {
        env: {
          log: (n) => this._addLog('export', `WASM 调用 JS env.log(${n}) —— 跨边界互操作成功`),
          abort: () => { throw new Error('WASM 调用 abort'); },
        },
      };
      const { module, instance } = await WebAssembly.instantiate(IMPORT_BYTES, importObject);
      this._importInstance = instance;
      const importsMeta = WebAssembly.Module.imports(module);
      const exportsMeta = WebAssembly.Module.exports(module);
      // 调用 instance.exports.run() → 内部 call $log(42) → 触发上面 env.log
      instance.exports.run();
      this.setState({
        runtimeResult:
          `importObject = { env: { log(n), abort() } }（JS 函数传给 WASM）\n` +
          `WebAssembly.instantiate(IMPORT_BYTES, importObject) → { module, instance } ✓\n` +
          `Module.imports() = ${JSON.stringify(importsMeta)}\n` +
          `Module.exports() = ${JSON.stringify(exportsMeta)}\n` +
          `instance.exports.run() → WASM 内 i32.const 42 + call $log → 触发 JS env.log(42)\n` +
          `说明：instance.exports 暴露 WASM 的函数/内存/表/全局给 JS；importObject 把 JS 函数交给 WASM 调用。`,
      });
      this._addLog('export', `互操作成功：imports=${JSON.stringify(importsMeta)}，exports=${JSON.stringify(exportsMeta)}`);
    } catch (err) {
      this._addLog('warn', `互操作失败：${err.name} - ${err.message}`);
      this.setState({ runtimeResult: `互操作失败：${err.name} - ${err.message}` });
    }
  }

  // 触发 RuntimeError（trap 模块 unreachable）+ 演示 CompileError / LinkError / Exception / Tag
  async _triggerRuntimeError() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly 不可用');
      return;
    }
    const lines = [];
    // 1) RuntimeError：实例化 trap 模块并调用 trap()（unreachable）
    try {
      const { instance } = await WebAssembly.instantiate(TRAP_BYTES, {});
      instance.exports.trap();
      lines.push('trap() 未抛错（意外）');
    } catch (err) {
      const isRuntime = typeof WebAssembly.RuntimeError !== 'undefined' && err instanceof WebAssembly.RuntimeError;
      lines.push(`[RuntimeError] 调用 trap()（unreachable 指令）：${err.name}: ${err.message}`);
      lines.push(`  err instanceof WebAssembly.RuntimeError = ${isRuntime}`);
      this._addLog('runtime', `RuntimeError 触发：${err.name}（unreachable），instanceof RuntimeError=${isRuntime}`);
    }
    // 2) CompileError：编译非法字节
    try {
      await WebAssembly.compile(BAD_BYTES);
      lines.push('[CompileError] 非法字节未抛错（意外）');
    } catch (err) {
      const isCompile = typeof WebAssembly.CompileError !== 'undefined' && err instanceof WebAssembly.CompileError;
      lines.push(`[CompileError] 编译非法字节 [..0xff 0xff]：${err.name}: ${err.message}`);
      lines.push(`  err instanceof WebAssembly.CompileError = ${isCompile}`);
      this._addLog('runtime', `CompileError 触发：${err.name}（字节码非法），instanceof CompileError=${isCompile}`);
    }
    // 3) LinkError：用空 importObject 实例化 IMPORT_BYTES（导入不匹配）
    try {
      await WebAssembly.instantiate(IMPORT_BYTES, {});
      lines.push('[LinkError] 导入不匹配未抛错（意外）');
    } catch (err) {
      const isLink = typeof WebAssembly.LinkError !== 'undefined' && err instanceof WebAssembly.LinkError;
      lines.push(`[LinkError] 缺少 env.log 导入：${err.name}: ${err.message}`);
      lines.push(`  err instanceof WebAssembly.LinkError = ${isLink}`);
      this._addLog('runtime', `LinkError 触发：${err.name}（导入不匹配），instanceof LinkError=${isLink}`);
    }
    // 4) WebAssembly.Tag / WebAssembly.Exception：异常标签与异常对象（wasm exceptions proposal）
    if (this._caps().tag && this._caps().exception) {
      try {
        const tag = new WebAssembly.Tag({ parameters: ['i32'] });
        const exc = new WebAssembly.Exception(tag, [42]);
        const isExc = exc instanceof WebAssembly.Exception;
        const arg = exc.getArg(tag, 0);
        lines.push(`[Tag/Exception] new Tag({ parameters: ['i32'] }) → new Exception(tag, [42])`);
        lines.push(`  exc instanceof WebAssembly.Exception = ${isExc}；exc.getArg(tag, 0) = ${arg}`);
        lines.push(`  说明：Tag 定义异常标签，Exception 携带 payload，可跨 WASM/JS 边界抛出与捕获。`);
        this._addLog('exc', `Tag + Exception 创建成功：getArg(tag,0)=${arg}，instanceof Exception=${isExc}`);
      } catch (err) {
        lines.push(`[Tag/Exception] 创建失败：${err.name} - ${err.message}`);
        this._addLog('exc', `Tag/Exception 创建失败：${err.message}`);
      }
    } else {
      lines.push('[Tag/Exception] 当前环境不支持 WebAssembly.Tag / Exception（需 wasm exceptions proposal）');
      this._addLog('exc', 'WebAssembly.Tag / Exception 不可用');
    }
    lines.push('\n错误类型对照：CompileError=编译期（字节非法）/ LinkError=链接期（导入不匹配）/ RuntimeError=运行期（除零、unreachable）');
    this.setState({ runtimeResult: lines.join('\n') });
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. WASM 与 JS 互操作 + 异常处理',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.wasm ? 'success' : 'error' }, caps.wasm ? '互操作 ✓' : '不可用'),
        h(Tag, { color: caps.exception && caps.tag ? 'primary' : 'warning' },
          caps.exception && caps.tag ? 'Exception/Tag ✓' : 'Exception/Tag ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'importObject 传入 JS 函数给 WASM 调用（{ env: { log, abort } }）；instance.exports 暴露 WASM 的函数/内存/表/全局给 JS。WebAssembly.RuntimeError=运行时错误（除零、unreachable）；CompileError=编译错误（字节码非法）；LinkError=链接错误（导入不匹配）；WebAssembly.Exception=异常对象，WebAssembly.Tag=异常标签，可与 wasm exceptions proposal 配合跨边界抛出。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('模拟互操作', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._demoInterop() }),
          this._btn('触发 RuntimeError', { danger: true, size: 'sm', disabled: !caps.wasm, onClick: () => this._triggerRuntimeError() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '互操作 / 异常处理结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.runtimeResult || '（点击「模拟互操作」或「触发 RuntimeError」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`// WASM 调用 JS：importObject 把 JS 函数交给 WASM
const importObject = { env: { log: (n) => console.log(n) } };
const { instance } = await WebAssembly.instantiate(bytes, importObject);
instance.exports.run();            // WASM 内部 call $log(42)

// 异常三兄弟（均为 Error 子类）
try { await WebAssembly.compile(badBytes); } catch (e) { /* CompileError */ }
try { await WebAssembly.instantiate(bytes, {}); } catch (e) { /* LinkError */ }
try { instance.exports.trap(); } catch (e) { /* RuntimeError */ }

// wasm exceptions proposal
const tag = new WebAssembly.Tag({ parameters: ['i32'] });
const exc = new WebAssembly.Exception(tag, [42]);`)),
        h(Alert, {
          type: 'warning',
          message: 'WASM 异常三兄弟：CompileError / LinkError / RuntimeError',
          description: 'CompileError 在 compile/instantiate 阶段抛出（字节非法）；LinkError 在 instantiate 阶段抛出（importObject 与模块导入声明不匹配）；RuntimeError 在调用导出函数时抛出（unreachable、除零、越界访问等）。三者均为 Error 子类，可用 instanceof 判别。',
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
      h('h2', { class: 'section-title' }, 'WebAssembly 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'WebAssembly（WASM）让 C/C++/Rust 等编译产物在浏览器中近原生速度运行。本页演示 Module/Instance/Memory/Table/Global 与 instantiateStreaming。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderLogPanel(),
    );
  }
}
