// =====================================================================
// WebAssemblyAdvancedPage.js —— WebAssembly 高级 proposal 特性实验室
// 演示 WASM 标准化进程中的新 proposal 特性：
//   1. Reference Types（funcref / externref）—— Global/Table 持有任意 JS 引用
//   2. Exception Handling（try/catch/throw）—— WebAssembly.Tag + Exception + try 指令
//   3. WebAssembly GC（struct/array）—— GC 类型，Dart/Kotlin/Java 编译前提，Chrome 119+
//   4. JSPI（JavaScript Promise Integration）—— 同步 wasm await JS Promise，Chrome 129+
//   5. Memory64 + Multi-Memory + Tail Calls —— 64 位内存 / 多 memory / 尾调用
//   6. Component Model + 生态对比与检测矩阵 —— WIT/WITX 工具链层
// 说明：多数 proposal 在 jsdom/Node 环境不可用。所有 API 调用前做能力检测，
//       不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。基础 WebAssembly
//       与 Reference Types / Exception Handling(JS API) 通常可用；GC / JSPI /
//       Memory64 / Multi-Memory / Tail Calls 等新 proposal 需较新浏览器（Chrome
//       119+/129+），部分需 flag。WASM 字节码用预编译的 Uint8Array，配合 try-catch
//       做 proposal feature-detect。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// GC proposal：含 struct 类型的最小模块（rec type group + struct field i32）
// (rec (type (struct (field i32)))) —— 不支持 GC 的环境抛 CompileError
// rec = 0x4e, struct = 0x5f
const GC_STRUCT_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x06, 0x01, 0x4e, 0x01, 0x5f, 0x01, 0x7f,
]);

// Multi-Memory proposal：声明 2 个 memory 的模块（标准 wasm 仅允许 1 个）
const MULTI_MEMORY_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x05, 0x07, 0x02,        // memory section, size 7, count 2
  0x01, 0x01, 0x01,        // memory 0: flags=0x01(max), initial=1, max=1
  0x01, 0x01, 0x01,        // memory 1: flags=0x01(max), initial=1, max=1
]);

// Tail Calls proposal：含 return_call 指令（opcode 0x12）的模块
// func 0: return_call 0（尾调用自身）；func 1: 空函数
const TAIL_CALL_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x04, 0x01, 0x60, 0x00, 0x00,                // type: () -> ()
  0x03, 0x03, 0x02, 0x00, 0x00,                      // function: 2 funcs of type 0
  0x0a, 0x09, 0x02,                                  // code section, size 9, count 2
    0x04, 0x00, 0x12, 0x00, 0x0b,                    // func 0: return_call 0, end
    0x02, 0x00, 0x0b,                                // func 1: end
]);

// Exception Handling proposal（legacy try/catch）：含 try 指令（opcode 0x06）
// try 块后需 catch/catch_all，此处仅用于检测 try 字节码是否被识别
const EH_TRY_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x04, 0x01, 0x60, 0x00, 0x00,                // type: () -> ()
  0x03, 0x02, 0x01, 0x00,                            // function: 1 func of type 0
  0x0a, 0x06, 0x01, 0x04, 0x00, 0x06, 0x00, 0x0b,    // code: try blocktype=void ... end
]);

export class WebAssemblyAdvancedPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：Reference Types
      refTypesResult: '',
      // Card 2：Exception Handling
      exceptionResult: '',
      // Card 3：WASM GC
      gcResult: '',
      // Card 4：JSPI
      jspiResult: '',
      // Card 5：Memory64 + Multi-Memory + Tail Calls
      memoryTailResult: '',
      // Card 6：Component Model + 检测矩阵
      matrixResult: '',
      // Card 9：JSPI + Memory64 + Multi-Memory 实战专题
      jspiInfo: '',
      memory64Info: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._externrefGlobal = null;  // Card 1 externref Global
    this._externrefTable = null;   // Card 1 externref Table
    this._ehTag = null;            // Card 2 WebAssembly.Tag
    this._ehException = null;      // Card 2 WebAssembly.Exception
    this._gcModule = null;         // Card 3 GC 模块（如编译成功）
    this._memory64 = null;         // Card 5 Memory64（如创建成功）

    const caps = this._caps();
    const parts = [
      `基础 WebAssembly ${caps.wasm ? '✓' : '✗'}`,
      `Reference Types(externref) ${caps.externref ? '✓' : '✗'}`,
      `Exception Handling ${caps.exception ? '✓' : '✗'}`,
      `WASM GC ${caps.gc ? '✓' : '✗'}`,
      `JSPI ${caps.jspi ? '✓' : '✗'}`,
      `Memory64 ${caps.memory64 ? '✓' : '✗'}`,
      `Multi-Memory ${caps.multiMemory ? '✓' : '✗'}`,
      `Tail Calls ${caps.tailCalls ? '✓' : '✗'}`,
      `Component Model ${caps.componentModel ? '✓(工具链)' : '工具链层'}`,
    ];
    const summary = caps.wasm
      ? `WebAssembly 高级 proposal 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）通常仅支持基础 WebAssembly 与 Reference Types / Exception Handling 的 JS API 部分；GC / JSPI / Memory64 / Multi-Memory / Tail Calls 等新 proposal 需较新浏览器（Chrome 119+/129+）且部分需 flag。不可用按钮点击将仅记日志说明，不会抛异常。`
      : '当前环境不支持 WebAssembly（typeof WebAssembly === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(caps.wasm ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.externref) this._addLog('warn', 'Reference Types(externref) 不可用，需支持 reference types proposal 的运行时');
    if (!caps.exception) this._addLog('warn', 'WebAssembly.Tag/Exception 不可用，需 exception handling proposal');
    if (!caps.gc) this._addLog('warn', 'WASM GC 不可用，需 Chrome 119+ 或启用 GC proposal 的运行时');
    if (!caps.jspi) this._addLog('warn', 'JSPI 不可用，需 Chrome 129+ 实验性 flag');
    if (!caps.memory64) this._addLog('warn', 'Memory64 不可用，需支持 memory64 proposal 的运行时');
  }

  componentWillUnmount() {
    // 释放各实例引用，便于 GC
    this._externrefGlobal = null;
    this._externrefTable = null;
    this._ehTag = null;
    this._ehException = null;
    this._gcModule = null;
    this._memory64 = null;
    this._capsCache = null;
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

  // 尝试编译字节码，返回是否成功（用于 proposal feature-detect）
  _tryCompile(bytes) {
    try { new WebAssembly.Module(bytes); return true; }
    catch { return false; }
  }

  // —— 同步能力检测（render 时调用，开销可忽略；首次计算后缓存）——
  _caps() {
    if (this._capsCache) return this._capsCache;
    const has = (n) => typeof WebAssembly !== 'undefined' && typeof WebAssembly[n] !== 'undefined';
    const wasm = has('Module');
    // Reference Types: 尝试创建 externref Global（externref 让 wasm 持有任意 JS 值引用）
    let externref = false;
    if (wasm) {
      try {
        const g = new WebAssembly.Global({ value: 'externref', mutable: true }, null);
        g.value = null;
        externref = true;
      } catch { /* 不支持 externref 类型 */ }
    }
    // Exception Handling: Tag / Exception JS API（wasm exceptions proposal）
    const exception = has('Tag') && has('Exception');
    // WASM GC: 编译含 struct 类型的模块
    const gc = wasm && this._tryCompile(GC_STRUCT_BYTES);
    // JSPI: Suspender 构造器 / promisify 函数
    const jspi = has('Suspender') || typeof WebAssembly.promisify === 'function';
    // Memory64: new Memory({ initial, index:'i64' })
    // 注意：部分引擎（如 V8）会忽略未知的 index 字段（连 index:'garbage' 也接受），
    // 需进一步用非法 index 验证字段是否被校验，避免假阳性。
    let memory64 = false;
    if (wasm) {
      try {
        new WebAssembly.Memory({ initial: 1, index: 'i64' });
        try {
          new WebAssembly.Memory({ initial: 1, index: '__invalid_index__' });
          // 非法 index 也被接受 → 字段被忽略，i64 不可信
          memory64 = false;
        } catch {
          // index 字段被校验：接受 i64 即为真实支持
          memory64 = true;
        }
      } catch { /* index:'i64' 不被支持 */ }
    }
    // Multi-Memory: 编译含 2 个 memory 的模块
    const multiMemory = wasm && this._tryCompile(MULTI_MEMORY_BYTES);
    // Tail Calls: 编译含 return_call 的模块（精确检测困难，此处尝试编译）
    const tailCalls = wasm && this._tryCompile(TAIL_CALL_BYTES);
    // Component Model: 运行时 API 尚未标准化，主要是工具链层（wasm-tools/wit）
    const componentModel = false;
    this._capsCache = {
      wasm, externref, exception, gc, jspi,
      memory64, multiMemory, tailCalls, componentModel,
    };
    return this._capsCache;
  }

  // =================== Card 1：Reference Types（funcref / externref）===================

  // 演示 externref Global / Table —— 持有任意 JS 值的引用（不止函数）
  _demoExternref() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly 不可用');
      return;
    }
    if (!this._caps().externref) {
      this._addLog('warn', 'externref 不可用：当前运行时不支持 reference types proposal 的 externref 类型');
      this.setState({
        refTypesResult:
          `externref 不可用：当前运行时不支持 reference types proposal 的 externref 类型。\n` +
          `需支持 reference types proposal 的运行时（Chrome 96+ / Node 16+ 内置）。\n\n` +
          `externref 让 wasm 模块能持有任意 JS 值的引用（不止函数），\n` +
          `包括对象、数组、字符串、DOM 节点等，与 funcref（原 anyfunc，仅函数引用）互补。`,
      });
      return;
    }
    try {
      const obj = { name: 'externref-demo', ts: Date.now() };
      const arr = [1, 2, 3];
      // Global with externref —— 持有任意 JS 值
      const gObj = new WebAssembly.Global({ value: 'externref', mutable: true }, obj);
      const gArr = new WebAssembly.Global({ value: 'externref', mutable: true }, arr);
      this._externrefGlobal = gObj;
      // Table with externref
      const table = new WebAssembly.Table({ element: 'externref', initial: 3 });
      this._externrefTable = table;
      table.set(0, obj);
      table.set(1, arr);
      table.set(2, null);
      // 读取验证：引用相等（非拷贝）
      const gotObj = gObj.value;
      const gotArr = gArr.value;
      const t0 = table.get(0);
      const t1 = table.get(1);
      const t2 = table.get(2);
      // ref.null 对应 JS null
      const nullLine = `table.get(2) === null → ${t2 === null}（externref 的 ref.null 即 JS null）`;
      // 修改原对象，引用同步可见（证明是引用而非拷贝）
      obj.name = 'mutated';
      const mutatedVisible = gotObj.name === 'mutated';
      this.setState({
        refTypesResult:
          `externref Global / Table —— 持有任意 JS 值的引用\n\n` +
          `new WebAssembly.Global({ value: 'externref', mutable: true }, obj)\n` +
          `  gObj.value === obj → ${gotObj === obj}（引用相等，非拷贝）\n` +
          `  gArr.value === arr → ${gotArr === arr}\n\n` +
          `new WebAssembly.Table({ element: 'externref', initial: 3 })\n` +
          `  table.set(0, obj) / table.set(1, arr) / table.set(2, null)\n` +
          `  table.get(0) === obj → ${t0 === obj}\n` +
          `  table.get(1) === arr → ${t1 === arr}\n` +
          `  ${nullLine}\n\n` +
          `引用语义验证：修改 obj.name='mutated' 后 gObj.value.name='${gotObj.name}'（同步可见=${mutatedVisible}）\n\n` +
          `说明：externref 让 wasm 模块持有任意 JS 值的引用（对象/数组/字符串/DOM 节点等），\n` +
          `  与 funcref（原 anyfunc，仅函数引用）互补。ref.null externref 即 JS null。\n` +
          `  生命周期由 JS 引擎管理（GC 后引用仍有效）。`,
      });
      this._addLog('ref', `externref Global/Table 创建成功：obj 引用相等=${gotObj === obj}，table.get(0)===obj=${t0 === obj}`);
    } catch (err) {
      this._addLog('warn', `externref 演示失败：${err.name} - ${err.message}`);
      this.setState({ refTypesResult: `externref 演示失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Reference Types（funcref / externref）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.externref ? 'success' : 'error' }, caps.externref ? 'externref ✓' : 'externref ✗'),
        h(Tag, { color: 'primary' }, 'reference types'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Reference Types proposal 引入 externref（持有任意 JS 值的引用，不止函数）与 funcref（原 anyfunc，函数引用）。WebAssembly.Global 与 WebAssembly.Table 的 value/element 可为 externref，让 wasm 模块直接持有 JS 对象/数组/DOM 节点等引用（非拷贝，引用语义）。ref.null externref 对应 JS null。检测方式：尝试 new WebAssembly.Global({ value: "externref", mutable: true }, null)。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 externref Global', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._demoExternref() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'externref 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.refTypesResult || '（点击「演示 externref Global」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（WAT + JS 互操作）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`;; externref: 持有任意 JS 值的引用（不止函数）
(module
  (import "env" "makeObj" (func (result externref)))
  (global $g (mut externref) (ref.null extern))
  (table 1 externref)
  (func (export "store") (param externref)
    local.get 0
    global.set $g           ;; 存入 externref global
    local.get 0
    table.set 0             ;; 存入 externref table
  )
  (func (export "load") (result externref)
    global.get $g           ;; 取出 externref
  )
)
;; JS 侧：externref 让 wasm 直接持有 JS 对象引用
const g = new WebAssembly.Global({ value: 'externref', mutable: true }, { a: 1 });
g.value;                    // { a: 1 }（引用相等）
const t = new WebAssembly.Table({ element: 'externref', initial: 1 });
t.set(0, document.body);    // 持有 DOM 节点引用`)),
        h(Alert, {
          type: 'info',
          message: 'externref vs funcref',
          description: 'funcref（原 anyfunc）仅持有函数引用；externref 持有任意 JS 值引用（对象/数组/DOM 节点等）。两者让 wasm 与 JS 之间无需序列化即可传递引用，是 GC proposal、JSPI 等高层 proposal 的基础。Chrome 96+ / Node 16+ 已内置。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Exception Handling（try/catch/throw）===================

  // 演示 WebAssembly.Tag + Exception（JS API）+ EH proposal try/catch/throw 字节码
  _demoException() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly 不可用');
      return;
    }
    const caps = this._caps();
    const lines = [];
    // 1) JS API: WebAssembly.Tag + WebAssembly.Exception
    if (caps.exception) {
      try {
        const tag = new WebAssembly.Tag({ parameters: ['i32', 'externref'] });
        this._ehTag = tag;
        const payloadObj = { hint: 'payload' };
        const exc = new WebAssembly.Exception(tag, [42, payloadObj]);
        this._ehException = exc;
        const isExc = exc instanceof WebAssembly.Exception;
        const arg0 = exc.getArg(tag, 0);
        const arg1 = exc.getArg(tag, 1);
        const isThrown = exc.is(tag);
        lines.push(`[JS API] new WebAssembly.Tag({ parameters: ['i32', 'externref'] })`);
        lines.push(`  new WebAssembly.Exception(tag, [42, { hint:'payload' }])`);
        lines.push(`  exc instanceof WebAssembly.Exception = ${isExc}`);
        lines.push(`  exc.getArg(tag, 0) = ${arg0}（i32 payload）`);
        lines.push(`  exc.getArg(tag, 1) = ${JSON.stringify(arg1)}（externref payload，引用相等=${arg1 === payloadObj}）`);
        lines.push(`  exc.is(tag) = ${isThrown}（异常是否属于该 tag）`);
        // 在 JS 中抛出并捕获
        try {
          throw exc;
        } catch (caught) {
          const caughtIs = caught instanceof WebAssembly.Exception;
          const caughtArg = caught.getArg(tag, 0);
          lines.push(`  throw exc → JS catch：caught instanceof Exception = ${caughtIs}，getArg(0) = ${caughtArg}`);
        }
        this._addLog('exc', `Tag+Exception 演示成功：getArg(0)=${arg0}，is(tag)=${isThrown}，JS throw/catch 成功`);
      } catch (err) {
        lines.push(`[JS API] Tag/Exception 操作失败：${err.name} - ${err.message}`);
        this._addLog('warn', `Tag/Exception 演示失败：${err.message}`);
      }
    } else {
      lines.push('[JS API] WebAssembly.Tag / Exception 不可用（需 exception handling proposal）');
      this._addLog('warn', 'WebAssembly.Tag / Exception 不可用');
    }
    // 2) EH proposal 的 try/catch/throw 指令（编译含 try 的模块）
    lines.push('');
    lines.push('[EH 字节码] 尝试编译含 try 指令的模块（EH proposal try/catch/throw_ref）：');
    if (this._tryCompile(EH_TRY_BYTES)) {
      lines.push('  编译成功 → 当前运行时支持 EH proposal 的 try 字节码指令');
    } else {
      lines.push('  编译失败（CompileError）→ 当前运行时不识别 try 指令字节码');
      lines.push('  说明：EH proposal 引入 try/catch/throw/throw_ref 指令，让 wasm 内部捕获异常。');
      lines.push('    新版 EH（try_table，0x01）已在 Chrome 95+ 落地；legacy try/catch（0x06）已废弃。');
      lines.push('    此处字节码仅用于 feature-detect 示意，精确检测以 typeof WebAssembly.Tag 为准。');
    }
    lines.push('');
    lines.push('与 JS try/catch 的关系：');
    lines.push('  • wasm 内部 try/catch（EH proposal）：在 wasm 模块内部捕获异常，不离开 wasm 栈');
    lines.push('  • 抛出到 JS：throw 指令抛出的 WebAssembly.Exception 可被外层 JS try/catch 捕获');
    lines.push('  • JS throw：JS 抛出的异常可被 wasm 内部 catch_all 捕获（需 EH proposal）');
    this.setState({ exceptionResult: lines.join('\n') });
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Exception Handling（try/catch/throw）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.exception ? 'success' : 'error' }, caps.exception ? 'Tag/Exception ✓' : 'Tag/Exception ✗'),
        h(Tag, { color: 'primary' }, 'EH proposal'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Exception Handling proposal 引入 try/catch/throw/throw_ref 字节码指令，让 wasm 模块内部捕获异常而非抛出到 JS。JS API 侧：WebAssembly.Tag 定义异常标签（带参数类型），WebAssembly.Exception 携带 payload，可跨 wasm/JS 边界抛出与捕获；exc.getArg(tag, index) 读取 payload，exc.is(tag) 判断归属。检测方式：typeof WebAssembly.Tag !== "undefined" + 编译含 try 指令的模块。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 WASM 异常处理', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._demoException() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '异常处理演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.exceptionResult || '（点击「演示 WASM 异常处理」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（WAT try/catch/throw）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`;; EH proposal: try/catch/throw
(module
  (tag $div_by_zero (param i32))           ;; 定义异常标签
  (func $thrower (export "thrower")
    i32.const 42
    throw $div_by_zero                      ;; 抛出异常
  )
  (func (export "tryCatch") (result i32)
    (try (result i32)
      (do
        call $thrower                       ;; 抛出
      )
      (catch $div_by_zero                   ;; 捕获特定 tag
        i32.const -1
      )
      (catch_all                            ;; 捕获任意异常
        i32.const -2
      )
    )
  )
)
;; JS 侧：Tag + Exception
const tag = new WebAssembly.Tag({ parameters: ['i32'] });
const exc = new WebAssembly.Exception(tag, [42]);
exc.getArg(tag, 0);  // 42
exc.is(tag);          // true
throw exc;            // 可被 JS try/catch 捕获`)),
        h(Alert, {
          type: 'warning',
          message: 'wasm 内部捕获 vs 抛出到 JS',
          description: 'EH proposal 的 try/catch 让 wasm 模块在内部捕获异常（不离开 wasm 栈，性能更好）；throw 指令抛出的 WebAssembly.Exception 会冒泡到外层 JS try/catch。新版 EH（try_table）已替代 legacy try/catch，Chrome 95+ 落地。WebAssembly.Tag/Exception 是 JS API 层，与字节码指令配套使用。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：WebAssembly GC（struct/array）===================

  // 检测 GC 支持：编译含 struct 类型的模块
  _detectGC() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly 不可用');
      return;
    }
    const caps = this._caps();
    if (caps.gc) {
      try {
        const module = new WebAssembly.Module(GC_STRUCT_BYTES);
        this._gcModule = module;
        const exportsMeta = WebAssembly.Module.exports(module);
        const importsMeta = WebAssembly.Module.imports(module);
        this.setState({
          gcResult:
            `WASM GC 支持检测：✓ 编译含 struct 类型的模块成功\n\n` +
            `new WebAssembly.Module(GC_STRUCT_BYTES) → Module ✓\n` +
            `Module.exports() = ${JSON.stringify(exportsMeta)}\n` +
            `Module.imports() = ${JSON.stringify(importsMeta)}\n\n` +
            `说明：GC proposal 让 wasm 模块直接定义 GC 管理的 struct/array 类型，\n` +
            `  由引擎自动回收，是 Dart/Kotlin/Java/Scala 编译到 wasm 的前提。\n` +
            `  JS API 无新全局构造器（无 WebAssembly.Struct 等），struct/array 操作\n` +
            `  通过 Module.exports 暴露的函数进行，返回的引用在 JS 中为不透明 ref 对象。`,
        });
        this._addLog('gc', 'GC proposal 支持检测：✓ 编译 struct 模块成功');
      } catch (err) {
        this._addLog('warn', `GC 模块编译失败：${err.name} - ${err.message}`);
        this.setState({ gcResult: `GC 模块编译失败：${err.name} - ${err.message}` });
      }
    } else {
      this.setState({
        gcResult:
          `WASM GC 支持检测：✗ 编译含 struct 类型的模块抛 CompileError\n\n` +
          `GC proposal（struct/array 类型）在当前运行时不可用。\n\n` +
          `什么是 WASM GC：\n` +
          `  • 让 wasm 模块直接定义 GC 管理的 struct/array 类型，由引擎自动回收\n` +
          `  • 是 Dart/Kotlin/Java/Scala/Ruby 编译到 wasm 的前提（避免每语言自带 GC）\n` +
          `  • Chrome 119+ 默认启用；Firefox/Safari 跟进中\n\n` +
          `典型 WAT 示例：\n` +
          `  (module\n` +
          `    (rec (type $point (struct (field i32) (field i32))))\n` +
          `    (func (export "makePoint") (param i32 i32) (result (ref $point))\n` +
          `      local.get 0  local.get 1  struct.new $point)\n` +
          `    (func (export "getX") (param (ref $point)) (result i32)\n` +
          `      local.get 0  struct.get $point 0)\n` +
          `  )\n\n` +
          `JS API：无新全局构造器（无 WebAssembly.Struct 等），struct/array 操作\n` +
          `  通过 Module.exports 暴露的函数进行，返回的引用在 JS 中为不透明的 ref 对象。`,
      });
      this._addLog('warn', 'WASM GC 不可用：编译 struct 模块抛 CompileError（需 Chrome 119+）');
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. WebAssembly GC（struct/array/externref GC 类型）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.gc ? 'success' : 'error' }, caps.gc ? 'GC ✓' : 'GC ✗'),
        h(Tag, { color: 'primary' }, 'Chrome 119+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'GC proposal 让 wasm 模块直接定义 GC 管理的 struct/array 类型，由引擎自动回收（无需每语言自带 GC）。是 Dart/Kotlin/Java/Scala/Ruby 编译到 wasm 的前提。Chrome 119+ 默认启用。JS API 无新全局构造器，struct/array 操作通过 Module.exports 暴露的函数进行。检测方式：编译含 struct.new 的模块（try-catch），成功即支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 GC 支持', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._detectGC() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'GC 检测结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.gcResult || '（点击「检测 GC 支持」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（WAT struct 类型）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`;; GC proposal: struct 类型（引擎自动回收）
(module
  (rec (type $point (struct (field i32) (field i32))))   ;; 定义 struct
  (func (export "makePoint") (param i32 i32) (result (ref $point))
    local.get 0
    local.get 1
    struct.new $point               ;; 创建 struct 实例
  )
  (func (export "getX") (param (ref $point)) (result i32)
    local.get 0
    struct.get $point 0             ;; 读取字段 0
  )
  (func (export "setX") (param (ref $point) (param i32)
    local.get 0
    local.get 1
    struct.set $point 0             ;; 写入字段 0
  )
)
;; JS 侧：无新构造器，通过 exports 调用
const { instance } = await WebAssembly.instantiate(gcBytes, {});
const p = instance.exports.makePoint(3, 4);   // 不透明 ref 对象
instance.exports.getX(p);                      // 3`)),
        h(Alert, {
          type: 'info',
          message: 'GC proposal 是高级语言编译到 wasm 的前提',
          description: '此前编译 Dart/Kotlin/Java 到 wasm 需在每个产物里内嵌语言自己的 GC（体积大、与 JS GC 冲突）；GC proposal 让 wasm 原生支持 struct/array 类型并由引擎统一回收，大幅减小产物体积、提升互操作。Chrome 119+ 默认启用，Firefox/Safari 跟进中。JS 侧无新全局 API，struct 引用是不透明对象。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：JSPI（JavaScript Promise Integration）===================

  // 检测 JSPI 支持：Suspender / promisify
  _detectJSPI() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly 不可用');
      return;
    }
    const caps = this._caps();
    if (caps.jspi) {
      let apiLine = '';
      let demoLine = '';
      try {
        if (typeof WebAssembly.Suspender !== 'undefined') {
          const suspender = new WebAssembly.Suspender();
          apiLine += `new WebAssembly.Suspender() → Suspender 实例 ✓\n  suspender = ${suspender}`;
        }
        if (typeof WebAssembly.promisify === 'function') {
          apiLine += `${apiLine ? '\n' : ''}WebAssembly.promisify(fn) → 可用 ✓\n  将返回 Promise 的 JS 函数包装为可被 wasm 同步 await 的函数`;
          const asyncFn = async (x) => { await Promise.resolve(); return x * 2; };
          const wrapped = WebAssembly.promisify(asyncFn);
          demoLine = `\n\n演示：WebAssembly.promisify(async (x) => x*2) → ${typeof wrapped}（包装后函数）`;
        }
      } catch (err) {
        apiLine += `\n（API 存在但调用失败：${err.name} - ${err.message}）`;
      }
      this.setState({
        jspiResult:
          `JSPI 支持检测：✓ 当前运行时支持 JavaScript Promise Integration\n\n` +
          `${apiLine}${demoLine}\n\n` +
          `JSPI 的用途：\n` +
          `  • 让同步的 wasm 函数能 await JS Promise\n` +
          `  • 把异步 JS 库（fetch / IndexedDB / WebRTC）桥接到 wasm\n` +
          `  • wasm 内部以同步写法调用 JS async 函数，运行时自动挂起/恢复\n` +
          `  • Chrome 129+ 实验性（需 flag），API 仍在演进`,
      });
      this._addLog('jspi', 'JSPI 支持检测：✓ Suspender/promisify 可用');
    } else {
      this.setState({
        jspiResult:
          `JSPI 支持检测：✗ WebAssembly.Suspender / promisify 均不可用\n\n` +
          `JSPI（JavaScript Promise Integration / Suspender）在当前运行时不可用。\n\n` +
          `什么是 JSPI：\n` +
          `  • 让同步的 wasm 函数能 await JS Promise\n` +
          `  • 把异步 JS 库（fetch / IndexedDB / WebRTC）桥接到 wasm\n` +
          `  • wasm 内部以同步写法调用 JS async 函数，运行时自动挂起/恢复\n` +
          `  • Chrome 129+ 实验性（需 flag），API 仍在演进\n\n` +
          `API 草案：\n` +
          `  const suspender = new WebAssembly.Suspender();\n` +
          `  const fetchSync = WebAssembly.promisify(fetch);  // async → 同步可调用\n` +
          `  // wasm 模块 import fetchSync，内部 call 即同步等待 Promise\n\n` +
          `检测方式：typeof WebAssembly.Suspender !== 'undefined' ||\n` +
          `          typeof WebAssembly.promisify === 'function'`,
      });
      this._addLog('warn', 'JSPI 不可用：WebAssembly.Suspender / promisify 均不存在（需 Chrome 129+ flag）');
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. JSPI（JavaScript Promise Integration / Suspender）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.jspi ? 'success' : 'error' }, caps.jspi ? 'JSPI ✓' : 'JSPI ✗'),
        h(Tag, { color: 'primary' }, 'Chrome 129+ flag'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'JSPI（JavaScript Promise Integration / Suspender）让同步的 wasm 函数能 await JS Promise：把异步 JS 库（fetch / IndexedDB / WebRTC）桥接到 wasm，wasm 内部以同步写法调用 JS async 函数，运行时自动挂起/恢复。API 草案：new WebAssembly.Suspender() + WebAssembly.promisify(fn)。Chrome 129+ 实验性（需 flag），API 仍在演进。检测方式：typeof WebAssembly.Suspender !== "undefined" || typeof WebAssembly.promisify === "function"。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 JSPI 支持', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._detectJSPI() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'JSPI 检测结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.jspiResult || '（点击「检测 JSPI 支持」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（概念示例）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`;; JSPI: wasm 同步调用 JS async 函数
(module
  (import "env" "fetchSync" (func $fetch (param externref) (result externref)))
  (func (export "getData") (param externref) (result externref)
    local.get 0
    call $fetch       ;; 同步等待 Promise（JSPI 自动挂起/恢复）
  )
)
;; JS 侧：用 Suspender + promisify 桥接 async fetch
const suspender = new WebAssembly.Suspender();
const fetchSync = WebAssembly.promisify(fetch);  // async → 同步可调用
const importObject = {
  env: { fetchSync: suspender.suspend(fetchSync) },
};
const { instance } = await WebAssembly.instantiate(bytes, importObject);
// wasm 内部 call fetchSync 即同步等待 Promise，不阻塞事件循环
const data = instance.exports.getData(url);     // 同步返回结果`)),
        h(Alert, {
          type: 'warning',
          message: 'JSPI 让 wasm 以同步写法调用异步 JS',
          description: '此前 wasm 调用 fetch 等异步 JS API 需在 wasm 侧手动管理 Promise 回调（繁琐且易错）；JSPI 让 wasm 函数内部以同步写法 await JS Promise，运行时自动挂起 wasm 栈、等待 Promise resolve 后恢复。Chrome 129+ 实验性，API 仍在演进（Suspender / SuspenderContext 等形态）。用途：把异步 JS 库桥接到 wasm，让 wasm 代码保持同步可读性。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：Memory64 + Multi-Memory + Tail Calls ===================

  // 检测 Memory64 / Multi-Memory / Tail Calls
  _detectMemoryTail() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly 不可用');
      return;
    }
    const caps = this._caps();
    const lines = [];
    // 1) Memory64
    lines.push('=== Memory64（64 位线性内存）===');
    if (caps.memory64) {
      try {
        const mem = new WebAssembly.Memory({ initial: 1, index: 'i64' });
        this._memory64 = mem;
        lines.push(`new WebAssembly.Memory({ initial: 1, index: 'i64' }) → Memory ✓`);
        lines.push(`  buffer.byteLength = ${mem.buffer.byteLength}（每页仍 64KB，但索引为 i64）`);
        lines.push(`  说明：Memory64 用 64 位索引，理论支持 >4GB 内存（需 64 位硬件地址空间）`);
        this._addLog('mem', 'Memory64 支持：✓ index:"i64" 可用');
      } catch (err) {
        lines.push(`Memory64 创建失败：${err.name} - ${err.message}`);
      }
    } else {
      lines.push(`✗ new WebAssembly.Memory({ initial: 1, index: 'i64' }) 抛 TypeError`);
      lines.push(`  Memory64 proposal 不可用：当前运行时不支持 index: 'i64' 参数`);
      lines.push(`  用途：64 位线性内存，支持 >4GB 寻址（i64 索引），用于大型数据集/数据库`);
      lines.push(`  检测：try new WebAssembly.Memory({ initial:1, index:'i64' })`);
      this._addLog('warn', 'Memory64 不可用：index:"i64" 不被支持');
    }
    // 2) Multi-Memory
    lines.push('');
    lines.push('=== Multi-Memory（一个模块多个 memory）===');
    if (caps.multiMemory) {
      lines.push(`编译含 2 个 memory 声明的模块 ✓`);
      lines.push(`  (module (memory 1) (memory 1)) —— 标准仅允许 1 个，multi-memory 放宽`);
      lines.push(`  用途：分离数据/堆栈/堆，模块内可同时操作多段线性内存`);
      this._addLog('mem', 'Multi-Memory 支持：✓ 编译 2 memory 模块成功');
    } else {
      lines.push(`✗ 编译含 2 个 memory 声明的模块抛 CompileError`);
      lines.push(`  Multi-Memory proposal 不可用：标准 wasm 每模块仅允许 1 个 memory`);
      lines.push(`  用途：分离数据/堆栈/堆，模块内可同时操作多段线性内存`);
      lines.push(`  检测：try compile 含 2 个 memory 段的字节码`);
      this._addLog('warn', 'Multi-Memory 不可用：编译 2 memory 模块抛 CompileError');
    }
    // 3) Tail Calls
    lines.push('');
    lines.push('=== Tail Calls（return_call / return_call_indirect）===');
    if (caps.tailCalls) {
      lines.push(`编译含 return_call 指令的模块 ✓`);
      lines.push(`  return_call / return_call_indirect 实现尾调用优化`);
      lines.push(`  用途：深递归不爆栈（如递归求和、状态机），复用当前栈帧`);
      this._addLog('mem', 'Tail Calls 支持：✓ 编译 return_call 模块成功');
    } else {
      lines.push(`✗ 编译含 return_call 指令的模块抛 CompileError`);
      lines.push(`  Tail Calls proposal 检测困难：return_call 与 call 的差异需运行时 feature-detect`);
      lines.push(`  说明：尾调用优化（return_call）复用当前栈帧，深递归不爆栈。`);
      lines.push(`    此处仅尝试编译，精确检测需对照支持/不支持的运行时行为。`);
      this._addLog('warn', 'Tail Calls 不可用：编译 return_call 模块抛 CompileError');
    }
    lines.push('');
    lines.push('三者对比：');
    lines.push('  • Memory64：内存容量扩展到 64 位索引（>4GB）');
    lines.push('  • Multi-Memory：单模块多段内存（数据隔离）');
    lines.push('  • Tail Calls：尾调用优化（深递归不爆栈）');
    this.setState({ memoryTailResult: lines.join('\n') });
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. Memory64 + Multi-Memory + Tail Calls',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.memory64 ? 'success' : 'error' }, caps.memory64 ? 'Memory64 ✓' : 'Memory64 ✗'),
        h(Tag, { color: caps.multiMemory ? 'success' : 'error' }, caps.multiMemory ? 'Multi-Mem ✓' : 'Multi-Mem ✗'),
        h(Tag, { color: caps.tailCalls ? 'success' : 'error' }, caps.tailCalls ? 'Tail ✓' : 'Tail ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Memory64：64 位线性内存（i64 索引，支持 >4GB），new WebAssembly.Memory({ initial, index: "i64" })。Multi-Memory：一个模块声明多个 memory（标准仅允许 1 个），分离数据/堆栈/堆。Tail Calls：return_call / return_call_indirect 尾调用优化，复用当前栈帧，深递归不爆栈。三者均处于 proposal 阶段，检测方式：Memory64 用 Memory 构造器 index 参数；Multi-Memory / Tail Calls 尝试编译含对应字节码的模块（try-catch）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测内存与尾调用', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._detectMemoryTail() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Memory64 / Multi-Memory / Tail Calls 检测结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.memoryTailResult || '（点击「检测内存与尾调用」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（WAT 示例）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } },
          h('code', {},
`;; Memory64: 64 位索引内存
(module
  (memory $m (i64) 1)            ;; index: i64
  (func (export "load64") (param i64) (result i32)
    local.get 0
    i32.load $m                  ;; 64 位地址加载
  )
)

;; Multi-Memory: 多个 memory
(module
  (memory $data 1)
  (memory $heap 1)
  (func (export "copy") (param i32)
    local.get 0
    local.get 0
    i32.load $data               ;; 从 data memory 读
    i32.store $heap              ;; 写入 heap memory
  )
)

;; Tail Calls: return_call（尾调用优化，深递归不爆栈）
(module
  (func $rec (export "rec") (param i32) (result i32)
    local.get 0
    i32.const 0
    i32.le_s
    if (result i32)
      i32.const 0
    else
      local.get 0
      local.get 0
      i32.const 1
      i32.sub
      return_call $rec           ;; 尾调用，复用栈帧
      i32.add
    end
  )
)`)),
        h(Alert, {
          type: 'info',
          message: '三个 proposal 各自扩展 wasm 的不同维度',
          description: 'Memory64 扩展内存容量（>4GB，用于数据库/大型数据集）；Multi-Memory 扩展内存数量（单模块多段，数据隔离）；Tail Calls 扩展调用语义（尾调用优化，深递归不爆栈）。三者均处于 proposal 阶段，尚未广泛落地。Tail Calls 精确 feature-detect 困难（return_call 与 call 的差异需运行时行为对照），此处仅尝试编译。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：Component Model + 生态对比与检测矩阵 ===================

  // 生成检测矩阵：遍历所有 proposal 能力检测结果
  _generateMatrix() {
    const caps = this._caps();
    const rows = [
      ['Reference Types', 'Global/Table 持有任意引用(externref/funcref)', 'Chrome 96+', 'typeof externref Global', caps.externref ? '✓ 可用' : '✗ 不可用'],
      ['Exception Handling', 'wasm 内部 try/catch/throw + Tag/Exception', 'Chrome 95+', 'typeof WebAssembly.Tag', caps.exception ? '✓ 可用' : '✗ 不可用'],
      ['WASM GC', 'struct/array GC 类型，Dart/Kotlin 前提', 'Chrome 119+', '编译含 struct 的模块', caps.gc ? '✓ 可用' : '✗ 不可用'],
      ['JSPI', '同步 wasm await JS Promise', 'Chrome 129+ flag', 'typeof WebAssembly.Suspender', caps.jspi ? '✓ 可用' : '✗ 不可用'],
      ['Memory64', '64 位线性内存(>4GB)', '提案中', 'new Memory({index:"i64"})', caps.memory64 ? '✓ 可用' : '✗ 不可用'],
      ['Multi-Memory', '单模块多个 memory', '提案中', '编译含 2 memory 的模块', caps.multiMemory ? '✓ 可用' : '✗ 不可用'],
      ['Tail Calls', 'return_call 尾调用优化', '提案中', '编译含 return_call 的模块', caps.tailCalls ? '✓ 可用' : '✗ 不可用'],
      ['Component Model', '模块间接口类型互操作(WIT)', '工具链层', '无标准化运行时 API', '工具链层(wasm-tools/wit)'],
    ];
    const available = rows.filter((r) => r[4].startsWith('✓')).length;
    const lines = [
      'WebAssembly 高级 proposal 检测矩阵：',
      '==============================================',
      ...rows.map((r) => `[${r[0].padEnd(20)}] ${r[4]}`),
      '',
      `共 ${rows.length} 项 proposal，当前环境可用 ${available} 项。`,
      '',
      '详细对照：',
      '----------------------------------------------',
      ...rows.flatMap((r) => [
        `• ${r[0]}`,
        `    用途：${r[1]}`,
        `    Chrome：${r[2]}`,
        `    检测：${r[3]}`,
        `    状态：${r[4]}`,
        '',
      ]),
      'Component Model 说明：',
      '  • 模块间接口类型互操作标准（WIT/WITX 描述接口契约）',
      '  • 主要是工具链层：wasm-tools / wit-bindgen / cargo-component',
      '  • 运行时 API 尚未标准化（无 WebAssembly.Component 构造器）',
      '  • 用途：让不同语言编译的 wasm 模块通过类型化接口互操作',
      '    （如 Rust 模块调用 JS 提供的接口，类型由 WIT 描述保证）',
    ];
    this.setState({ matrixResult: lines.join('\n') });
    this._addLog('matrix', `生成检测矩阵：${rows.length} 个 proposal，可用 ${available} 个`);
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. Component Model + 生态对比与检测矩阵',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'Component Model'),
        h(Tag, { color: 'warning' }, '工具链层'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Component Model 让不同语言编译的 wasm 模块通过类型化接口（WIT/WITX 描述契约）互操作，主要是工具链层（wasm-tools / wit-bindgen / cargo-component），运行时 API 尚未标准化（无 WebAssembly.Component 构造器）。本卡片汇总所有 proposal 的用途、Chrome 版本、检测方式与状态，生成检测矩阵文本表格。点击「生成检测矩阵」遍历所有 proposal 能力检测结果。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('生成检测矩阵', { type: 'primary', size: 'sm', onClick: () => this._generateMatrix() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '检测矩阵：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.matrixResult || '（点击「生成检测矩阵」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（WIT 接口定义）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`;; Component Model: WIT 接口定义（.wit 文件）
package example:demo;

interface utils {
  add: func(a: i32, b: i32) -> i32;
}

world demo-world {
  import utils;              // 导入其他 component 的接口
  export run: func() -> i32; // 导出本 component 的接口
}

;; 工具链：wasm-tools component new module.wasm -o component.wasm
;;         wit-bindgen 生成各语言绑定（Rust/JS/Python 等）
;; 运行时：尚无标准化 JS API（无 WebAssembly.Component）
;;         主要由 Wasmtime / WasmEdge / wasi-http 等运行时支持`)),
        h(Alert, {
          type: 'info',
          message: 'Component Model 是 wasm 生态互操作的标准层',
          description: 'Component Model 不引入新的 JS 运行时 API，而是定义模块间接口类型互操作标准（WIT 描述契约），由 wasm-tools / wit-bindgen / cargo-component 等工具链支持。让 Rust/Go/JS 等不同语言编译的 wasm 模块通过类型化接口互操作，是 WASI Preview 2 的基础。浏览器运行时 API 尚未标准化。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 9：JSPI + Memory64 + Multi-Memory 实战专题 ===================

  // JSPI 实战：Suspender / wrapPromise / WASM 调用 fetch / Emscripten / wasm-bindgen 协同
  _runJSPIDemo() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly 不可用');
      return;
    }
    const caps = this._caps();
    const lines = [];
    lines.push('=== JSPI（JavaScript Promise Integration）实战 ===');
    lines.push('');
    lines.push('【概述】');
    lines.push('  • WebAssembly CG（Community Group）proposal');
    lines.push('  • JavaScript Promise Integration（JSPI）');
    lines.push('  • 让 WASM 模块可调用异步 Promise 并被反向回调');
    lines.push('  • WASM 异步化核心提案（asyncify 的标准化继任）');
    lines.push('  • 浏览器支持：Chrome 123+ 稳定');
    lines.push('');
    lines.push('【Suspender 与 WebAssembly.Suspender】');
    lines.push('  • new WebAssembly.Suspender() —— 创建挂起器');
    lines.push('  • suspender.suspend() —— 在 WASM 内暂停执行栈');
    lines.push('  • 与 Promise 协同：suspend 挂起，Promise resolve 后恢复');
    lines.push('  • import 对象包装：将 async JS 函数包装为同步可调用');
    lines.push('');
    lines.push('【JS Promise 集成】');
    lines.push('  • new WebAssembly.Instance(module, {');
    lines.push('      env: { fetch: suspender.wrapPromise(fetch) }');
    lines.push('    })');
    lines.push('  • suspender.suspend() 在 WASM 内暂停');
    lines.push('  • Promise resolve 后自动恢复 WASM 栈');
    lines.push('  • 与 async/await 对比：');
    lines.push('    - JS async/await：函数级挂起，需 Promise 链');
    lines.push('    - JSPI：栈级挂起，WASM 内同步写法，运行时自动管理');
    lines.push('');
    lines.push('【实战场景】');
    lines.push('  • WASM 调用 fetch：suspender.wrapPromise(fetch) 桥接');
    lines.push('  • WASM 异步 I/O：IndexedDB / WebRTC / 文件读取');
    lines.push('  • Emscripten 集成：emcc --js-promise 编译选项');
    lines.push('  • Rust wasm-bindgen：#[wasm_bindgen] + JSPI 协同');
    lines.push('');
    lines.push('=== 当前运行时 JSPI API 探测 ===');
    if (caps.jspi) {
      try {
        if (typeof WebAssembly.Suspender !== 'undefined') {
          const suspender = new WebAssembly.Suspender();
          lines.push(`  new WebAssembly.Suspender() → ${suspender} ✓`);
          ['suspend', 'wrapPromise', 'wrapSync'].forEach((m) => {
            const fn = typeof suspender[m] === 'function';
            lines.push(`  suspender.${m}() → ${fn ? '可用 ✓' : '不存在'}`);
          });
        }
        if (typeof WebAssembly.promisify === 'function') {
          const asyncFn = async (x) => { await Promise.resolve(); return x * 2; };
          const wrapped = WebAssembly.promisify(asyncFn);
          lines.push(`  WebAssembly.promisify(asyncFn) → ${typeof wrapped} ✓`);
        }
        this._addLog('jspi', 'JSPI 实战：API 探测成功（Suspender/promisify 可用）');
      } catch (err) {
        lines.push(`  API 探测失败：${err.name} - ${err.message}`);
        this._addLog('warn', `JSPI 实战探测失败：${err.message}`);
      }
    } else {
      lines.push('  ✗ WebAssembly.Suspender / promisify 不可用（需 Chrome 123+）');
      this._addLog('warn', 'JSPI 实战：API 不可用（需 Chrome 123+），已输出概念说明');
    }
    this.setState({ jspiInfo: lines.join('\n') });
  }

  // Memory64 + Multi-Memory 实战：大内存 / 多内存隔离 / 与 SIMD/Threads 协同
  _runMemory64Demo() {
    if (!this._caps().wasm) {
      this._addLog('warn', 'WebAssembly 不可用');
      return;
    }
    const caps = this._caps();
    const lines = [];
    lines.push('=== Memory64 + Multi-Memory 实战 ===');
    lines.push('');
    lines.push('【Memory64 概述】');
    lines.push('  • 64 位内存地址（i64 索引）');
    lines.push('  • WebAssembly.Memory({ initial, index: "i64" })');
    lines.push('  • 突破 4GB 限制（标准 32 位仅 4GB 寻址）');
    lines.push('  • 浏览器支持：Chrome behind flag');
    lines.push('    (--js-flags=--experimental-wasm-memory64)');
    lines.push('');
    lines.push('【Multi-Memory 概述】');
    lines.push('  • 单模块声明多个 memory（标准仅 1 个）');
    lines.push('  • import 多个 memory：模块间共享/隔离内存');
    lines.push('  • 内存隔离：数据 / 堆栈 / 堆 分离');
    lines.push('  • 浏览器支持：Chrome behind flag');
    lines.push('    (--js-flags=--experimental-wasm-multi-memory)');
    lines.push('');
    lines.push('【实战场景】');
    lines.push('  • 大内存 WASM 应用：>4GB 数据集 / 数据库 / 视频处理');
    lines.push('  • 多模块内存隔离：每模块独立 memory，避免地址冲突');
    lines.push('  • 与 SIMD/Threads 协同：');
    lines.push('    - Memory64 + SIMD：64 位地址的 SIMD 加载');
    lines.push('    - Multi-Memory + Threads：每线程独立 memory');
    lines.push('    - Memory64 + Threads + SharedArrayBuffer：超大共享内存');
    lines.push('');
    lines.push('=== 当前运行时 Memory64 / Multi-Memory 探测 ===');
    lines.push('--- Memory64 ---');
    if (caps.memory64) {
      try {
        const mem = new WebAssembly.Memory({ initial: 1, index: 'i64' });
        lines.push(`  new Memory({ initial:1, index:'i64' }) → ${mem.buffer.byteLength} bytes ✓`);
        lines.push(`  索引类型：i64（支持 >4GB 寻址）`);
        this._addLog('mem', 'Memory64 实战：Memory 创建成功（i64 索引）');
      } catch (err) {
        lines.push(`  创建失败：${err.name} - ${err.message}`);
      }
    } else {
      lines.push('  ✗ index:"i64" 不被支持（需启用 memory64 flag）');
      this._addLog('warn', 'Memory64 实战：不可用（需 flag），已输出概念说明');
    }
    lines.push('--- Multi-Memory ---');
    if (caps.multiMemory) {
      lines.push('  编译含 2 个 memory 的模块 ✓');
      lines.push('  (module (memory 1) (memory 1)) —— 标准仅允许 1 个');
      this._addLog('mem', 'Multi-Memory 实战：编译 2 memory 模块成功');
    } else {
      lines.push('  ✗ 编译 2 memory 模块抛 CompileError（需启用 multi-memory flag）');
      this._addLog('warn', 'Multi-Memory 实战：不可用（需 flag），已输出概念说明');
    }
    this.setState({ memory64Info: lines.join('\n') });
  }

  _renderCard9() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '9. JSPI + Memory64 + Multi-Memory 实战专题',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.jspi ? 'success' : 'error' }, caps.jspi ? 'JSPI ✓' : 'JSPI ✗'),
        h(Tag, { color: caps.memory64 ? 'success' : 'error' }, caps.memory64 ? 'Mem64 ✓' : 'Mem64 ✗'),
        h(Tag, { color: caps.multiMemory ? 'success' : 'error' }, caps.multiMemory ? 'Multi ✓' : 'Multi ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'JSPI（JavaScript Promise Integration）：WebAssembly CG proposal，让 WASM 模块可调用异步 Promise 并被反向回调，是 WASM 异步化核心提案（asyncify 的标准化继任），Chrome 123+ 稳定。Memory64：64 位内存地址（i64 索引），突破 4GB 限制。Multi-Memory：单模块多 memory，内存隔离。后两者 Chrome behind flag。本卡片为实战专题，覆盖 Suspender API、wrapPromise、Emscripten/wasm-bindgen 协同、大内存应用、多模块隔离、与 SIMD/Threads 协同。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 JSPI 实战', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._runJSPIDemo() }),
          this._btn('运行 Memory64/Multi-Memory 实战', { type: 'primary', size: 'sm', disabled: !caps.wasm, onClick: () => this._runMemory64Demo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'JSPI 实战结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.jspiInfo || '（点击「运行 JSPI 实战」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Memory64 / Multi-Memory 实战结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.memory64Info || '（点击「运行 Memory64/Multi-Memory 实战」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（JSPI + Memory64 + Multi-Memory）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {},
`;; === JSPI: WASM 同步调用 JS async fetch ===
(module
  (import "env" "fetchSync" (func $fetch (param externref) (result externref)))
  (func (export "getData") (param externref) (result externref)
    local.get 0
    call $fetch       ;; WASM 内同步等待 Promise（JSPI 挂起/恢复）
  )
)
;; JS 侧：Suspender + wrapPromise 桥接 async fetch
const suspender = new WebAssembly.Suspender();
const importObject = {
  env: { fetchSync: suspender.wrapPromise(fetch) },
};
const { instance } = await WebAssembly.instantiate(bytes, importObject);
const data = instance.exports.getData(url);  // 同步返回，不阻塞事件循环

;; === Memory64: 64 位索引内存（>4GB）===
(module
  (memory (i64) 1)                    ;; index: i64
  (func (export "load64") (param i64) (result i32)
    local.get 0
    i32.load                          ;; 64 位地址加载
  )
)
;; JS 侧
const mem = new WebAssembly.Memory({ initial: 1, index: 'i64' });

;; === Multi-Memory: 单模块多 memory（隔离）===
(module
  (memory $data 1)
  (memory $heap 1)
  (func (export "copy") (param i32)
    local.get 0
    local.get 0
    i32.load $data                    ;; 从 data memory 读
    i32.store $heap                   ;; 写入 heap memory
  )
)

;; === 实战协同 ===
;; • Emscripten: emcc --js-promise -sALLOW_MEMORY_GROWTH
;; • Rust wasm-bindgen: #[wasm_bindgen] async fn + JSPI
;; • Memory64 + Threads: SharedArrayBuffer >4GB
;; • Multi-Memory + SIMD: 各 memory 独立 SIMD 加载`)),
        h(Alert, {
          type: 'warning',
          message: 'JSPI 让 WASM 异步化，Memory64/Multi-Memory 扩展内存模型',
          description: 'JSPI（Chrome 123+ 稳定）让同步 WASM 函数能 await JS Promise，是 asyncify 的标准化继任，使 WASM 调用 fetch/IndexedDB 等异步 API 保持同步写法。Memory64（i64 索引）突破 4GB 限制，用于数据库/视频处理等大内存应用。Multi-Memory 允许单模块多段内存，实现数据/堆栈/堆隔离。后两者 Chrome behind flag。三者可与 SIMD/Threads 协同：Memory64+Threads 超大共享内存，Multi-Memory+SIMD 各 memory 独立 SIMD 加载。',
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
      h('h2', { class: 'section-title' }, 'WebAssembly 高级 proposal 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 WebAssembly 标准化进程中的新 proposal 特性：Reference Types、Exception Handling、WASM GC、JSPI、Memory64、Multi-Memory、Tail Calls、Component Model。多数 proposal 在 jsdom/Node 不可用，需较新浏览器（Chrome 119+/129+）。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard9(),
      this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
