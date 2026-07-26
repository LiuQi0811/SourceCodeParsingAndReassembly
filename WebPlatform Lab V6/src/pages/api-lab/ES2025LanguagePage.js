// =====================================================================
// ES2025LanguagePage.js —— ES2025 语言新特性实验室
// 演示：
//   1. AsyncIterator Helpers（ES2025）：AsyncIterator.prototype
//      map / filter / take / drop / toArray —— 异步迭代器惰性链式
//      对应 ES2024 同步 Iterator helpers（已在 ModernES2024Page 演示）
//   2. ShadowRealm —— 隔离的 JS 执行环境（new ShadowRealm() /
//      realm.evaluate / realm.importValue）
//   3. Error.isError + RegExp.escape（ES2025 小工具）：
//      跨 realm Error 判定 / 安全转义正则元字符
//   4. Math.f16round + Float16Array（ES2025 半精度浮点）：
//      ML 推理 / WebGPU 数据交换场景
//   5. SuppressedError + DisposableStack 进阶（ES2025/2026 ERM）：
//      using 释放时若原异常被抑制则包装为 SuppressedError
//      （DisposableStack/using 已在 AdvancedJSRuntimePage 演示，
//        本卡聚焦 SuppressedError 语义）
//   6. Decorators（TC39 Stage 3）—— 装饰器语法：@logged / @bound /
//      @memoize / Symbol.metadata。语法层面特性无法运行时 typeof
//      检测，用普通 JS 手动实现等价行为作对照
// 说明：ES2025 提案特性需 Node 22+ / 较新浏览器。所有 API 调用前做
//       typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常。Decorators 是语法特性无法 typeof 检测。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class ES2025LanguagePage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      asyncIterResult: '',      // Card 1：AsyncIterator helpers
      shadowRealmResult: '',    // Card 2：ShadowRealm
      errorRegExpResult: '',    // Card 3：Error.isError + RegExp.escape
      float16Result: '',        // Card 4：Math.f16round + Float16Array
      suppressedResult: '',     // Card 5：SuppressedError + DisposableStack
      decoratorResult: '',      // Card 6：Decorators
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._shadowRealm = null;     // Card 2 ShadowRealm 实例

    const caps = this._caps();
    const parts = [
      `AsyncIterator helpers ${caps.asyncIter ? '✓' : '✗'}`,
      `AsyncIterator.from ${caps.asyncIterFrom ? '✓' : '✗'}`,
      `ShadowRealm ${caps.shadowRealm ? '✓' : '✗'}`,
      `Error.isError ${caps.errorIsError ? '✓' : '✗'}`,
      `RegExp.escape ${caps.regExpEscape ? '✓' : '✗'}`,
      `Math.f16round ${caps.mathF16round ? '✓' : '✗'}`,
      `Float16Array ${caps.float16Array ? '✓' : '✗'}`,
      `SuppressedError ${caps.suppressedError ? '✓' : '✗'}`,
      `DisposableStack ${caps.disposableStack ? '✓' : '✗'}`,
    ];
    const allModern = caps.asyncIter && caps.shadowRealm && caps.errorIsError &&
      caps.regExpEscape && caps.mathF16round && caps.float16Array &&
      caps.suppressedError && caps.disposableStack;
    const summary = allModern
      ? `ES2025 能力检测：${parts.join(' · ')}。当前环境支持全部 ES2025 提案特性，所有按钮可真实演示（Decorators 除外，其为语法特性需编译）。`
      : `ES2025 能力检测：${parts.join(' · ')}。多数特性为 TC39 Stage 3/4 提案，需 Node 22+ / 较新浏览器；不可用的按钮点击将仅记日志说明，不会抛异常。`;

    this.setState({ capsSummary: summary });
    this._addLog(allModern ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.asyncIter) this._addLog('warn', 'AsyncIterator helpers 不可用（AsyncIterator 全局对象或 .map 不存在），ES2025 提案；同步版 Iterator helpers 已在 ModernES2024Page 演示');
    if (!caps.shadowRealm) this._addLog('warn', 'ShadowRealm 不可用，TC39 Stage 3 提案');
    if (!caps.errorIsError) this._addLog('warn', 'Error.isError 不可用，ES2025 提案');
    if (!caps.regExpEscape) this._addLog('warn', 'RegExp.escape 不可用，ES2025 提案');
    if (!caps.mathF16round) this._addLog('warn', 'Math.f16round 不可用，ES2025 提案');
    if (!caps.float16Array) this._addLog('warn', 'Float16Array 不可用，ES2025 提案');
    if (!caps.suppressedError) this._addLog('warn', 'SuppressedError 不可用，ES2025/2026 ERM 提案');
    this._addLog('info', 'Decorators 为 TC39 Stage 3 语法特性，无法运行时 typeof 检测，需 TS 5/Babel/SWC 编译或原生支持；本页用普通 JS 手动模拟等价行为');
  }

  componentWillUnmount() {
    // 释放实例引用，便于 GC
    this._shadowRealm = null;
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
    // AsyncIterator 全局对象在老引擎不存在，typeof 直接引用会抛 ReferenceError，需 try/catch
    let asyncIter = false;
    let asyncIterFrom = false;
    try {
      asyncIter = typeof AsyncIterator !== 'undefined' &&
        typeof AsyncIterator.prototype.map === 'function';
      asyncIterFrom = typeof AsyncIterator !== 'undefined' &&
        typeof AsyncIterator.from === 'function';
    } catch { /* 老引擎无 AsyncIterator 全局对象 */ }
    const shadowRealm = typeof ShadowRealm !== 'undefined';
    const errorIsError = typeof Error !== 'undefined' && typeof Error.isError === 'function';
    const regExpEscape = typeof RegExp !== 'undefined' && typeof RegExp.escape === 'function';
    const mathF16round = typeof Math !== 'undefined' && typeof Math.f16round === 'function';
    const float16Array = typeof Float16Array !== 'undefined';
    const suppressedError = typeof SuppressedError !== 'undefined';
    let disposableStack = false;
    try { disposableStack = typeof DisposableStack !== 'undefined'; } catch { /* 老引擎无此全局 */ }
    // Math.fround 作为 Float16 不可用时的兜底概念演示
    const mathFRound = typeof Math !== 'undefined' && typeof Math.fround === 'function';
    return {
      asyncIter, asyncIterFrom, shadowRealm, errorIsError, regExpEscape,
      mathF16round, float16Array, suppressedError, disposableStack, mathFRound,
    };
  }

  // =================== Card 1：AsyncIterator Helpers（ES2025）===================

  // AsyncIterator.prototype.map/filter/take/drop/toArray —— 异步迭代器惰性链式
  async _asyncIterChain() {
    const caps = this._caps();
    if (!caps.asyncIter) {
      this._addLog('warn', 'AsyncIterator helpers 不可用，将用普通 async generator + 手动 for await 模拟链式行为');
      // 模拟：用 async generator + 手动循环实现等价 map/filter/take
      try {
        const gen = async function* () { for (let i = 1; i <= 8; i++) yield i; };
        // 等价于 .map(x => x*2).filter(x => x > 5).take(3)
        const collected = [];
        let count = 0;
        for await (const x of gen()) {
          const mapped = x * 2;
          if (mapped > 5) {
            collected.push(mapped);
            count++;
            if (count >= 3) break;  // take(3)
          }
        }
        this.setState({
          asyncIterResult:
            `【模拟模式】AsyncIterator helpers 不可用，用 async generator + 手动 for await 模拟\n\n` +
            `目标等价链：gen().map(x => x*2).filter(x => x>5).take(3).toArray()\n\n` +
            `async function* gen() { for (let i=1; i<=8; i++) yield i; }\n` +
            `const collected = [];\n` +
            `for await (const x of gen()) {\n` +
            `  const mapped = x * 2;            // 等价 .map\n` +
            `  if (mapped > 5) {                // 等价 .filter\n` +
            `    collected.push(mapped);\n` +
            `    if (collected.length >= 3) break; // 等价 .take(3)\n` +
            `  }\n` +
            `}\n` +
            `结果 = ${JSON.stringify(collected)}（应为 [6,8,10]）\n\n` +
            `说明：AsyncIterator helpers 是 ES2025 提案（同步版 Iterator helpers 已在 ModernES2024Page 演示）。\n` +
            `  不可用时手动 for await + break 可模拟 take 的提前终止语义，但失去链式表达力。`,
        });
        this._addLog('async', `【模拟】AsyncIterator 链式结果=${JSON.stringify(collected)}（手动 for await）`);
      } catch (err) {
        this._addLog('warn', `AsyncIterator 模拟失败：${err.name} - ${err.message}`);
      }
      return;
    }
    try {
      this._addLog('async', '开始 AsyncIterator helpers 链式演示…');
      const asyncGen = async function* () { for (let i = 1; i <= 8; i++) yield i; };
      // 链式：×2 → 保留 >5 → 取前 3 → 转数组
      const chain = asyncGen().map((x) => x * 2).filter((x) => x > 5).take(3);
      const arr = await chain.toArray();           // [6,8,10]
      // 惰性求值验证：take(n) 取够即停，不消费剩余元素
      let consumed = 0;
      const lazy = await asyncGen()
        .map((x) => { consumed++; return x * 10; })
        .take(2)
        .toArray();
      // drop 演示
      const dropped = await asyncGen().drop(5).take(2).toArray(); // [6,7]
      this.setState({
        asyncIterResult:
          `asyncGen() = async function*() { for (i=1..8) yield i; }\n\n` +
          `.map(x => x*2).filter(x => x>5).take(3).toArray()\n` +
          `  await chain.toArray() = ${JSON.stringify(arr)}（= [6,8,10]）\n\n` +
          `惰性求值验证：asyncGen().map(×10).take(2).toArray() = ${JSON.stringify(lazy)}\n` +
          `  map 回调仅被调用 ${consumed} 次（take(2) 取够即停，剩余元素不计算）\n\n` +
          `drop(n) + take(n)：asyncGen().drop(5).take(2).toArray() = ${JSON.stringify(dropped)}\n\n` +
          `说明：AsyncIterator.prototype.map/filter/take/drop 返回新的 AsyncIterator，\n` +
          `  toArray() 返回 Promise<Array>，需 await。与同步 Iterator helpers 区别在于\n` +
          `  回调可为 async、迭代源可为 async iterable。Iterator.from（ES2024）同步，\n` +
          `  AsyncIterator.from（ES2025）异步，二者均为对应全局构造器的静态方法。`,
      });
      this._addLog('async', `AsyncIterator 链式 toArray()=${JSON.stringify(arr)}；惰性验证 take(2) 仅消费 ${consumed} 个；drop+take=${JSON.stringify(dropped)}`);
    } catch (err) {
      this._addLog('warn', `AsyncIterator helpers 失败：${err.name} - ${err.message}`);
    }
  }

  // AsyncIterator.from(asyncIterable) —— 把异步可迭代对象包装为 AsyncIterator
  async _asyncIterFrom() {
    const caps = this._caps();
    if (!caps.asyncIterFrom) {
      this._addLog('warn', 'AsyncIterator.from 不可用（ES2025），需较新引擎');
      return;
    }
    try {
      // 自定义异步可迭代对象
      const asyncRange = {
        from: 1, to: 5,
        [Symbol.asyncIterator]() {
          let i = this.from; const end = this.to;
          return {
            async next() {
              await Promise.resolve();
              return i <= end ? { value: i++, done: false } : { value: undefined, done: true };
            },
          };
        },
      };
      const it = AsyncIterator.from(asyncRange);
      const isInst = it instanceof AsyncIterator;
      const squared = await it.map((x) => x * x).toArray();   // [1,4,9,16,25]
      this.setState({
        asyncIterResult:
          `自定义异步可迭代对象 asyncRange = { from:1, to:5, [Symbol.asyncIterator]() {...} }\n` +
          `AsyncIterator.from(asyncRange) → AsyncIterator 实例（instanceof AsyncIterator = ${isInst}）\n` +
          `  await it.map(x => x*x).toArray() = ${JSON.stringify(squared)}\n\n` +
          `说明：AsyncIterator.from(asyncIterable) 将任意异步可迭代对象统一为 AsyncIterator，\n` +
          `  之后即可链式调用 map/filter/take/drop 等 helper，最终用 await .toArray() 求值。\n` +
          `  Iterator.from（ES2024）处理同步可迭代对象，AsyncIterator.from（ES2025）处理异步。`,
      });
      this._addLog('async', `AsyncIterator.from(range).map(²).toArray()=${JSON.stringify(squared)}；instanceof=${isInst}`);
    } catch (err) {
      this._addLog('warn', `AsyncIterator.from 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. AsyncIterator Helpers（ES2025）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.asyncIter ? 'success' : 'error' }, caps.asyncIter ? 'AsyncIterator ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '异步惰性链式'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'AsyncIterator.prototype 新增 map / filter / take / drop / toArray 等方法，返回 AsyncIterator 实例（非数组），惰性求值——只有调用 await toArray() 才真正计算。对应 ES2024 同步 Iterator helpers（已在 ModernES2024Page 演示），区别在于回调可为 async、迭代源为 async iterable。AsyncIterator.from(asyncIterable) 把任意异步可迭代对象转为 AsyncIterator。检测方式：typeof AsyncIterator !== "undefined" && typeof AsyncIterator.prototype.map === "function"（注意 AsyncIterator 在老引擎非全局对象，typeof 直接引用会抛 ReferenceError，需 try/catch）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 AsyncIterator helpers', { type: 'primary', size: 'sm', onClick: () => this._asyncIterChain() }),
          this._btn('AsyncIterator.from', { size: 'sm', disabled: !caps.asyncIterFrom, onClick: () => this._asyncIterFrom() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'AsyncIterator 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.asyncIterResult || '（点击按钮演示 AsyncIterator helpers；不可用时将用普通 async generator 模拟）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`const gen = async function*() { for (let i=1; i<=8; i++) yield i; };
// 链式：×2 → 保留 >5 → 取前 3 → await toArray()
const r = await gen().map(x => x*2).filter(x => x>5).take(3).toArray();
// r = [6, 8, 10]
const it = AsyncIterator.from(asyncIterable);   // ES2025 静态方法
const sq = await it.map(x => x*x).toArray();     // Promise<Array>`)),
        h(Alert, {
          type: 'info',
          message: 'AsyncIterator helpers 让异步迭代器也能惰性链式',
          description: '与同步 Iterator helpers 对应，AsyncIterator.prototype.map/filter/take/drop 返回新 AsyncIterator，toArray() 返回 Promise<Array> 需 await。take(n) 在取够 n 个后立即停止消费上游，对无限异步流（如 WebSocket 消息流、分页 API）尤为关键。不可用时可用 for await...of + break 手动模拟 take 的提前终止语义，但失去链式表达力。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：ShadowRealm ===================

  // new ShadowRealm() + realm.evaluate + realm.importValue —— 隔离执行环境
  _createShadowRealm() {
    const caps = this._caps();
    if (!caps.shadowRealm) {
      this._addLog('warn', 'ShadowRealm 不可用（TC39 Stage 3 提案），需较新引擎；无法演示隔离执行环境');
      this.setState({
        shadowRealmResult:
          `ShadowRealm 不可用（TC39 Stage 3 提案，部分浏览器/Node 尚未实现）\n\n` +
          `概念说明：ShadowRealm 提供一个独立的 JS 执行环境，拥有自己的全局对象、\n` +
          `  内置函数（Date/Math/JSON 等）与原型链，与主 realm 完全隔离。\n` +
          `  - new ShadowRealm() 创建实例\n` +
          `  - realm.evaluate('1+2') 同步执行表达式，返回原始值（number/string/boolean/null/undefined，\n` +
          `    不能直接返回对象/函数，对象需通过 callable wrapper 间接传递）\n` +
          `  - realm.importValue('./mod.js', 'exported') 异步导入模块的导出值（返回 Promise）\n\n` +
          `vs Worker / iframe：\n` +
          `  - ShadowRealm：同步、轻量、无 DOM、独立全局对象\n` +
          `  - Worker：独立线程，通信走 postMessage（异步）\n` +
          `  - iframe：有 DOM/window，开销大，同源策略复杂\n\n` +
          `典型用途：插件沙箱、第三方代码隔离、AOP 织入、避免原型污染。\n` +
          `  因内置函数独立，realm 内修改 Array.prototype 不影响主 realm。`,
      });
      return;
    }
    try {
      const realm = new ShadowRealm();
      this._shadowRealm = realm;
      // evaluate：同步执行表达式，返回原始值
      const sum = realm.evaluate('1 + 2');                 // 3
      const squared = realm.evaluate('x => x * x');        // 返回 callable wrapper
      const sq9 = squared(9);                              // 81
      // 隔离验证：realm 内修改全局对象不影响主 realm
      realm.evaluate('Array.prototype.hacked = true');
      const mainHacked = typeof [].hacked !== 'undefined'; // false（主 realm 未受污染）
      const realmHacked = realm.evaluate('[].hacked');     // true（仅 realm 内）
      // 独立内置函数：realm 内的 Date 与主 realm 的 Date 是不同构造器
      const sameDateCtor = realm.evaluate('Date') === Date; // false
      this.setState({
        shadowRealmResult:
          `const realm = new ShadowRealm()\n\n` +
          `realm.evaluate('1 + 2') = ${sum}\n` +
          `realm.evaluate('x => x*x') 返回 callable → squared(9) = ${sq9}\n\n` +
          `隔离验证：\n` +
          `  realm.evaluate('Array.prototype.hacked = true')\n` +
          `  主 realm [].hacked 是否存在 = ${mainHacked}（false：主 realm 未被污染）\n` +
          `  realm 内 [].hacked = ${realmHacked}（true：仅 realm 内生效）\n\n` +
          `独立内置函数：realm.evaluate('Date') === Date = ${sameDateCtor}（false：\n` +
          `  realm 有自己的 Date 构造器，与主 realm 完全隔离）\n\n` +
          `说明：evaluate 同步返回原始值（number/string/boolean/null/undefined）或 callable\n` +
          `  wrapper（函数），不能直接返回对象——对象需通过 callable 间接传递。\n` +
          `  importValue(specifier, exportName) 异步导入模块导出（返回 Promise），\n` +
          `  适合动态加载第三方代码到隔离环境。`,
      });
      this._addLog('realm', `ShadowRealm 创建：evaluate('1+2')=${sum}，squared(9)=${sq9}，主 realm 隔离=${!mainHacked}`);
    } catch (err) {
      this._addLog('warn', `ShadowRealm 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. ShadowRealm —— 隔离的 JS 执行环境',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.shadowRealm ? 'success' : 'error' }, caps.shadowRealm ? 'ShadowRealm ✓' : 'Stage 3 ✗'),
        h(Tag, { color: 'primary' }, '沙箱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ShadowRealm 提供独立的 JS 执行环境，拥有自己的全局对象、内置函数（Date/Math/JSON 等）与原型链，与主 realm 完全隔离。new ShadowRealm() 创建实例；realm.evaluate(code) 同步执行表达式返回原始值或 callable wrapper（不能直接返回对象）；realm.importValue(specifier, exportName) 异步导入模块导出（返回 Promise）。vs Worker：同步、轻量、无 DOM；vs iframe：无 DOM/window、开销小。检测方式：typeof ShadowRealm !== "undefined"。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建 ShadowRealm', { type: 'primary', size: 'sm', disabled: !caps.shadowRealm, onClick: () => this._createShadowRealm() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'ShadowRealm 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.shadowRealmResult || '（点击按钮演示 ShadowRealm；不可用时将显示概念说明）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`const realm = new ShadowRealm();
const sum = realm.evaluate('1 + 2');           // 3（原始值）
const sq = realm.evaluate('x => x*x');         // callable wrapper
sq(9);                                          // 81
// 隔离：realm 内修改 Array.prototype 不影响主 realm
realm.evaluate('Array.prototype.hacked = true');
[].hacked;                                      // undefined（主 realm 未受污染）
// 异步导入模块导出
const fn = await realm.importValue('./mod.js', 'default');`)),
        h(Alert, {
          type: 'warning',
          message: 'ShadowRealm vs Worker vs iframe',
          description: 'ShadowRealm：同步、轻量、无 DOM、独立全局对象与内置函数，适合插件沙箱、第三方代码隔离、AOP 织入。Worker：独立线程，通信走 postMessage（异步），适合 CPU 密集任务。iframe：有 DOM/window，开销大，同源策略复杂。注意 ShadowRealm 的 evaluate 只能返回原始值或 callable wrapper——对象需通过 callable 间接传递，避免跨 realm 引用泄漏。当前为 TC39 Stage 3 提案，部分浏览器/Node 尚未实现。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Error.isError + RegExp.escape（ES2025）===================

  // Error.isError(x)：跨 realm 判断是否为 Error 实例（vs instanceof Error 跨 realm 失效）
  _testErrorIsError() {
    const caps = this._caps();
    if (!caps.errorIsError) {
      this._addLog('warn', 'Error.isError 不可用（ES2025 提案），将用 instanceof + duck typing 模拟');
      // 模拟：跨 realm 场景下 instanceof Error 失效，用 duck typing 兜底
      try {
        const e = new Error('boom');
        const instanceofCheck = e instanceof Error;       // true（同 realm）
        const duckCheck = e instanceof Error ||
          (e && typeof e === 'object' && typeof e.message === 'string' && typeof e.name === 'string');
        // 模拟跨 realm：Object.prototype.toString 是内置跨 realm 可靠手段
        const toStringTag = Object.prototype.toString.call(e); // '[object Error]'
        this.setState({
          errorRegExpResult:
            `【模拟模式】Error.isError 不可用（ES2025 提案），展示跨 realm 判定的痛点\n\n` +
            `const e = new Error('boom')\n` +
            `  e instanceof Error = ${instanceofCheck}（同 realm 内为 true）\n\n` +
            `跨 realm 问题说明：\n` +
            `  若 e 来自 ShadowRealm / iframe / Worker，e instanceof 主 realm 的 Error 会是 false\n` +
            `  （因为 e 的原型链指向 realm 内部的 Error 构造器，与主 realm 的 Error 是不同对象）\n\n` +
            `传统兜底方案：\n` +
            `  1) Duck typing：${duckCheck}（检查 message/name 属性，但不可靠）\n` +
            `  2) Object.prototype.toString.call(e) = ${toStringTag}\n` +
            `     （返回 '[object Error]'，因 toString 内部用 [[Class]] 内部槽，跨 realm 可靠）\n\n` +
            `ES2025 方案：Error.isError(x) 跨 realm 可靠判断（内部检查 [[ErrorData]] 内部槽）。\n` +
            `  检测方式：typeof Error.isError === 'function'。`,
        });
        this._addLog('err', `【模拟】Error 判定：instanceof=${instanceofCheck}，toStringTag=${toStringTag}`);
      } catch (err) {
        this._addLog('warn', `Error.isError 模拟失败：${err.name} - ${err.message}`);
      }
      return;
    }
    try {
      const e = new Error('boom');
      const t = new TypeError('type');
      const o = { message: 'fake' };
      const n = null;
      const checks = [
        `Error.isError(new Error('boom')) = ${Error.isError(e)}`,       // true
        `Error.isError(new TypeError('type')) = ${Error.isError(t)}`,   // true（子类）
        `Error.isError({ message:'fake' }) = ${Error.isError(o)}`,      // false（鸭子对象）
        `Error.isError(null) = ${Error.isError(n)}`,                    // false
        `Error.isError('string') = ${Error.isError('string')}`,         // false
      ];
      // instanceof 对比：同 realm 也能判，但跨 realm 失效
      const instanceofSame = e instanceof Error;   // true
      this.setState({
        errorRegExpResult:
          `Error.isError(x) → boolean：跨 realm 可靠判断是否为 Error 实例\n\n` +
          checks.join('\n') + '\n\n' +
          `对比 instanceof Error（同 realm）：new Error('boom') instanceof Error = ${instanceofSame}\n` +
          `  同 realm 内 instanceof 也能判，但跨 realm（ShadowRealm/iframe/Worker）时\n` +
          `  instanceof 因原型链指向 realm 内部 Error 构造器而失效，Error.isError 则\n` +
          `  内部检查 [[ErrorData]] 内部槽，跨 realm 可靠。\n\n` +
          `说明：Error.isError 接受任意值（含 null/undefined/原始值），不抛异常。\n` +
          `  Error 子类（TypeError/RangeError/SyntaxError 等）也返回 true。`,
      });
      this._addLog('err', `Error.isError：Error=${Error.isError(e)}，TypeError=${Error.isError(t)}，duck对象=${Error.isError(o)}`);
    } catch (err) {
      this._addLog('warn', `Error.isError 演示失败：${err.name} - ${err.message}`);
    }
  }

  // RegExp.escape(str)：转义正则元字符，安全拼接用户输入到正则
  _testRegExpEscape() {
    const caps = this._caps();
    if (!caps.regExpEscape) {
      this._addLog('warn', 'RegExp.escape 不可用（ES2025 提案），将手动模拟转义');
      // 模拟：手动转义正则元字符
      try {
        const userInput = 'a.b*c+d?e[f]g(h)';
        // 手动转义：转义所有正则元字符
        const manualEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escaped = manualEscape(userInput);
        const re = new RegExp(escaped);
        const match = re.test('xa.b*c+d?e[f]g(h)y');  // true（字面匹配）
        const noMatch = re.test('axy');                // false
        this.setState({
          errorRegExpResult:
            (this.state.errorRegExpResult ? this.state.errorRegExpResult + '\n\n' : '') +
            `【模拟模式】RegExp.escape 不可用（ES2025 提案），手动转义正则元字符\n\n` +
            `用户输入：${JSON.stringify(userInput)}（含 . * + ? [ ] ( ) 等元字符）\n` +
            `手动转义函数：s => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')\n` +
            `转义结果：${JSON.stringify(escaped)}\n\n` +
            `new RegExp(escaped).test('xa.b*c+d?e[f]g(h)y') = ${match}（字面匹配，true）\n` +
            `new RegExp(escaped).test('axy') = ${noMatch}（false：不匹配）\n\n` +
            `说明：若不转义，new RegExp('a.b') 中的 . 会匹配任意字符（'axb' 也命中），\n` +
            `  导致用户输入被当作正则模式解释，可能引发 ReDoS 或误匹配。\n` +
            `  ES2025 的 RegExp.escape(str) 标准化此转义，安全拼接用户输入到正则。\n` +
            `  检测方式：typeof RegExp.escape === 'function'。`,
        });
        this._addLog('re', `【模拟】RegExp 转义：escaped=${JSON.stringify(escaped)}，match=${match}`);
      } catch (err) {
        this._addLog('warn', `RegExp.escape 模拟失败：${err.name} - ${err.message}`);
      }
      return;
    }
    try {
      const userInput = 'a.b*c+d?e[f]g(h)';
      const escaped = RegExp.escape(userInput);
      const re = new RegExp(escaped);
      const match = re.test('xa.b*c+d?e[f]g(h)y');   // true（字面匹配）
      const noMatch = re.test('axy');                  // false
      // 对比不转义的危险
      const dangerousRe = new RegExp(userInput);       // 元字符被解释
      const dangerousMatch = dangerousRe.test('axbyc');  // true（. 匹配任意字符）
      this.setState({
        errorRegExpResult:
          (this.state.errorRegExpResult ? this.state.errorRegExpResult + '\n\n' : '') +
          `RegExp.escape(str) → string：转义正则元字符，安全拼接用户输入到正则\n\n` +
          `用户输入：${JSON.stringify(userInput)}\n` +
          `RegExp.escape(userInput) = ${JSON.stringify(escaped)}\n\n` +
          `安全使用：new RegExp(RegExp.escape(userInput))\n` +
          `  .test('xa.b*c+d?e[f]g(h)y') = ${match}（字面匹配，true）\n` +
          `  .test('axy') = ${noMatch}（false：不匹配）\n\n` +
          `危险对比：new RegExp(userInput)（不转义，元字符被解释）\n` +
          `  .test('axbyc') = ${dangerousMatch}（true：. 匹配任意字符，误匹配）\n\n` +
          `说明：RegExp.escape 转义所有正则元字符（. * + ? ^ $ { } ( ) | [ ] \\），\n` +
          `  使其作为字面字符匹配。适合把用户输入作为固定字符串搜索的场景，\n` +
          `  避免 ReDoS（正则拒绝服务）与误匹配。`,
      });
      this._addLog('re', `RegExp.escape：escaped=${JSON.stringify(escaped)}，安全 match=${match}，危险 match=${dangerousMatch}`);
    } catch (err) {
      this._addLog('warn', `RegExp.escape 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. Error.isError + RegExp.escape（ES2025 小工具）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.errorIsError ? 'success' : 'error' }, caps.errorIsError ? 'Error.isError ✓' : 'Error.isError ✗'),
        h(Tag, { color: caps.regExpEscape ? 'success' : 'error' }, caps.regExpEscape ? 'RegExp.escape ✓' : 'RegExp.escape ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Error.isError(x) → boolean：跨 realm 可靠判断是否为 Error 实例（内部检查 [[ErrorData]] 内部槽），vs instanceof Error 在跨 realm（ShadowRealm/iframe/Worker）时因原型链指向不同构造器而失效。RegExp.escape(str) → string：转义所有正则元字符（. * + ? ^ $ { } ( ) | [ ] \\），安全把用户输入作为字面字符拼接到正则，避免 ReDoS 与误匹配。检测：typeof Error.isError === "function" / typeof RegExp.escape === "function"。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('测试 Error.isError', { type: 'primary', size: 'sm', onClick: () => this._testErrorIsError() }),
          this._btn('测试 RegExp.escape', { type: 'primary', size: 'sm', onClick: () => this._testRegExpEscape() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Error.isError / RegExp.escape 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.errorRegExpResult || '（点击按钮演示；不可用时将手动模拟并说明）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`// Error.isError：跨 realm 可靠判断
Error.isError(new Error('x'));     // true
Error.isError(new TypeError('y')); // true（子类）
Error.isError({ message: 'z' });   // false
// RegExp.escape：安全拼接用户输入到正则
const re = new RegExp(RegExp.escape('a.b*c'));
re.test('xa.b*cy');  // true（字面匹配，元字符被转义）`)),
        h(Alert, {
          type: 'info',
          message: '两个小工具解决两个老痛点',
          description: 'Error.isError 解决 instanceof Error 跨 realm 失效问题（此前只能用 Object.prototype.toString.call 检查 [[Class]]）；RegExp.escape 解决用户输入拼接到正则时的元字符转义问题（此前需手写 s.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&")，容易漏字符）。两者均为 ES2025 标准化提案，把社区惯用法升级为内置 API。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Math.f16round + Float16Array（ES2025）===================

  // Math.f16round(x)：四舍五入到半精度浮点（16-bit）；Float16Array：半精度类型化数组
  _float16Demo() {
    const caps = this._caps();
    if (!caps.mathF16round && !caps.float16Array) {
      this._addLog('warn', 'Math.f16round / Float16Array 不可用（ES2025 提案），用 Math.fround（Float32）兜底演示概念');
      // 用 Math.fround（Float32 单精度）兜底演示"精度 vs 内存"概念
      try {
        const x = 1.1;
        const f64Bits = x;                          // Float64（默认）
        const f32Round = caps.mathFRound ? Math.fround(x) : x;  // Float32 兜底
        const bytesF64 = 8;
        const bytesF32 = 4;
        const bytesF16 = 2;
        this.setState({
          float16Result:
            `【兜底模式】Math.f16round / Float16Array 不可用（ES2025 提案），用 Math.fround 演示概念\n\n` +
            `三种浮点格式对比（以 x = ${x} 为例）：\n` +
            `  Float64（双精度）：值 = ${f64Bits}，占 ${bytesF64} 字节，精度约 15-17 位十进制\n` +
            `  Float32（单精度）：Math.fround(${x}) = ${f32Round}，占 ${bytesF32} 字节，精度约 6-9 位\n` +
            `  Float16（半精度）：ES2025 Math.f16round / Float16Array，占 ${bytesF16} 字节，精度约 3-4 位\n\n` +
            `精度损失可见：Float32 已与 Float64 有差异（${f32Round} vs ${f64Bits}），\n` +
            `  Float16 损失更大但内存减半，适合 ML 推理、WebGPU 数据交换等"精度不敏感、内存敏感"场景。\n\n` +
            `ES2025 提案（待实现）：\n` +
            `  Math.f16round(x) → 四舍五入到 IEEE 754 半精度（16-bit）\n` +
            `  Float16Array → 半精度类型化数组，与 Float32Array/Float64Array 同接口\n` +
            `  检测：typeof Math.f16round === 'function' / typeof Float16Array !== 'undefined'`,
        });
        this._addLog('f16', `【兜底】Float32 兜底演示：Math.fround(${x})=${f32Round}（Float16 不可用）`);
      } catch (err) {
        this._addLog('warn', `Float16 兜底演示失败：${err.name} - ${err.message}`);
      }
      return;
    }
    try {
      const x = 1.1;
      const pi = Math.PI;
      const xF16 = caps.mathF16round ? Math.f16round(x) : x;
      const xF32 = Math.fround(x);
      const piF16 = caps.mathF16round ? Math.f16round(pi) : pi;
      const piF32 = Math.fround(pi);
      let float16ArrLines = '';
      if (caps.float16Array) {
        const arr = new Float16Array([1.5, 2.5, 3.14159]);
        const bytesPerElem = arr.BYTES_PER_ELEMENT;   // 2
        const sum = arr.reduce((a, b) => a + b, 0);
        const f32Arr = new Float32Array([1.5, 2.5, 3.14159]);
        const f32Sum = f32Arr.reduce((a, b) => a + b, 0);
        float16ArrLines =
          `\nFloat16Array 演示：\n` +
          `  new Float16Array([1.5, 2.5, 3.14159])\n` +
          `  BYTES_PER_ELEMENT = ${bytesPerElem}（Float32Array 为 4，Float64Array 为 8）\n` +
          `  reduce 求和 = ${sum}（Float32Array 同数据求和 = ${f32Sum}，可见精度差异）\n` +
          `  长度 = ${arr.length}，元素访问与 Float32Array 完全一致`;
      }
      this.setState({
        float16Result:
          `Math.f16round(x)：四舍五入到 IEEE 754 半精度浮点（16-bit）\n` +
          `Float16Array：半精度类型化数组，ML 推理 / WebGPU 数据交换\n\n` +
          `三种精度对比：\n` +
          `  x = ${x}\n` +
          `    Float64（默认）  = ${x}\n` +
          `    Float32 (fround) = ${xF32}\n` +
          `    Float16 (f16round)= ${xF16}\n\n` +
          `  Math.PI = ${pi}\n` +
          `    Float64（默认）  = ${pi}\n` +
          `    Float32 (fround) = ${piF32}\n` +
          `    Float16 (f16round)= ${piF16}\n\n` +
          `内存占用（每元素）：Float64=8 字节 ｜ Float32=4 字节 ｜ Float16=2 字节\n` +
          `精度范围：Float64 ~15-17 位 ｜ Float32 ~6-9 位 ｜ Float16 ~3-4 位${float16ArrLines}\n\n` +
          `说明：Float16 牺牲精度换取内存减半，适合 ML 推理（推理阶段对精度不敏感）、\n` +
          `  WebGPU 纹理/顶点数据交换（GPU 原生支持 half-float）。Float16Array 与\n` +
          `  Float32Array 接口完全一致，可无缝替换。`,
      });
      this._addLog('f16', `Float16 演示：f16round(${x})=${xF16}，f16round(π)=${piF16}${caps.float16Array ? '，Float16Array OK' : ''}`);
    } catch (err) {
      this._addLog('warn', `Float16 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. Math.f16round + Float16Array（ES2025 半精度浮点）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.mathF16round ? 'success' : 'error' }, caps.mathF16round ? 'Math.f16round ✓' : 'Math.f16round ✗'),
        h(Tag, { color: caps.float16Array ? 'success' : 'error' }, caps.float16Array ? 'Float16Array ✓' : 'Float16Array ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Math.f16round(x) → number：四舍五入到 IEEE 754 半精度浮点（16-bit），对应 Math.fround（Float32）与 Math.round（整数）。Float16Array：半精度类型化数组，每元素 2 字节（vs Float32Array 4 字节、Float64Array 8 字节），与两者接口完全一致。典型用途：ML 推理（推理阶段对精度不敏感）、WebGPU 纹理/顶点数据交换（GPU 原生支持 half-float）。检测：typeof Math.f16round === "function" / typeof Float16Array !== "undefined"。不可用时用 Math.fround（Float32）兜底演示"精度 vs 内存"概念。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('半精度浮点演示', { type: 'primary', size: 'sm', onClick: () => this._float16Demo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Float16 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.float16Result || '（点击按钮演示；不可用时将用 Math.fround 兜底演示概念）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`Math.f16round(1.1);     // 半精度舍入（Float32 用 Math.fround）
Math.f16round(Math.PI); // 比 Float32 精度更低，但占 2 字节
const arr = new Float16Array([1.5, 2.5, 3.14159]);
arr.BYTES_PER_ELEMENT;  // 2（Float32Array=4，Float64Array=8）
arr.reduce((a,b)=>a+b,0); // 接口与 Float32Array 完全一致`)),
        h(Alert, {
          type: 'info',
          message: '半精度浮点：精度 vs 内存的权衡',
          description: 'Float16 牺牲精度（约 3-4 位十进制有效数字）换取内存减半，适合 ML 推理、WebGPU 数据交换等"精度不敏感、内存敏感"场景。训练阶段通常用 Float32/Float64 保证梯度精度，推理阶段用 Float16 加速并降低显存占用。Float16Array 与 Float32Array/Float64Array 接口完全一致，可无缝替换。当前为 ES2025 提案，部分环境尚未实现，可用 Math.fround（Float32）演示概念。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：SuppressedError + DisposableStack 进阶 ===================

  // SuppressedError：using 释放资源时若原异常被抑制则包装
  _suppressedErrorDemo() {
    const caps = this._caps();
    if (!caps.suppressedError) {
      this._addLog('warn', 'SuppressedError 不可用（ES2025/2026 ERM 提案），将用普通 Error + try/finally 模拟语义');
      // 模拟：try/finally 中 finally 抛错会抑制原异常（仅最后异常可见）
      try {
        let caught = null;
        try {
          const fakeDispose = () => { throw new Error('dispose 抛错'); };
          try {
            throw new Error('original 业务异常');
          } finally {
            try { fakeDispose(); } catch (e) { caught = e; }
          }
        } catch (e) {
          caught = e;
        }
        this.setState({
          suppressedResult:
            `【模拟模式】SuppressedError 不可用（ES2025/2026 ERM 提案），演示语义\n\n` +
            `场景：using 声明的资源在块结束时自动 [Symbol.dispose]()；\n` +
            `  若块内抛了"业务异常"，dispose 又抛了"清理异常"，则业务异常被抑制，\n` +
            `  ES2025 用 SuppressedError(error, suppressed, message) 把两个异常包装在一起。\n\n` +
            `模拟代码（try/finally）：\n` +
            `  try {\n` +
            `    throw new Error('original 业务异常');\n` +
            `  } finally {\n` +
            `    throw new Error('dispose 抛错');  // 抑制 original\n` +
            `  }\n` +
            `  → finally 抛的 Error 会"吞掉" try 里的 original（仅 dispose 异常可见）\n\n` +
            `模拟结果：caught = ${caught ? caught.message : 'null'}\n` +
            `  （传统 try/finally 只能保留最后一个异常，original 被丢失）\n\n` +
            `ES2025 SuppressedError 方案：\n` +
            `  new SuppressedError(error, suppressed, message)\n` +
            `    - error：后抛出的异常（dispose 异常，作为"主"错误）\n` +
            `    - suppressed：被抑制的异常（原业务异常）\n` +
            `    - message：描述字符串\n` +
            `  err.suppressed 可访问被抑制的原异常，避免异常丢失。\n\n` +
            `说明：DisposableStack/using 已在 AdvancedJSRuntimePage 演示，本卡聚焦 SuppressedError。\n` +
            `  using 是语法关键字，运行时无法 typeof 检测，需编译或原生支持。`,
        });
        this._addLog('erm', `【模拟】SuppressedError 语义：caught=${caught ? caught.message : 'null'}（original 被抑制丢失）`);
      } catch (err) {
        this._addLog('warn', `SuppressedError 模拟失败：${err.name} - ${err.message}`);
      }
      return;
    }
    try {
      // 构造一个 dispose 会抛错的资源（ DisposableStack 可用时用真 using 语义）
      // 由于 using 是语法关键字无法运行时检测，这里用 DisposableStack + 显式 dispose 模拟
      let result = '';
      let caughtErr = null;
      let isSuppressed = false;
      let suppressedMsg = '';
      let errorMsg = '';
      if (caps.disposableStack) {
        // 用 DisposableStack 模拟 using 语义：业务抛错 + dispose 抛错 → SuppressedError
        const stack = new DisposableStack();
        stack.defer(() => { throw new Error('dispose 清理异常'); });
        try {
          try {
            // 模拟业务代码：先抛业务异常，再让 stack 在 finally 释放时抛清理异常
            throw new Error('original 业务异常');
          } finally {
            try { stack[Symbol.dispose](); } catch (e) { throw e; }
          }
        } catch (e) {
          caughtErr = e;
          isSuppressed = e instanceof SuppressedError;
          suppressedMsg = e.suppressed ? e.suppressed.message : '(无)';
          errorMsg = e.message;
        }
        result =
          `SuppressedError 演示（用 DisposableStack 模拟 using 释放语义）\n\n` +
          `const stack = new DisposableStack();\n` +
          `  stack.defer(() => { throw new Error('dispose 清理异常'); });\n` +
          `try {\n` +
          `  throw new Error('original 业务异常');   // 业务异常\n` +
          `} finally {\n` +
          `  stack[Symbol.dispose]();               // 释放时抛清理异常\n` +
          `}\n\n` +
          `catch 捕获的异常：\n` +
          `  instanceof SuppressedError = ${isSuppressed}\n` +
          `  err.message = ${JSON.stringify(errorMsg)}\n` +
          `  err.suppressed.message = ${JSON.stringify(suppressedMsg)}（被抑制的原业务异常）\n\n` +
          `说明：err.suppressed 字段保留原业务异常，避免异常丢失。\n` +
          `  SuppressedError 构造签名：new SuppressedError(error, suppressed, message)\n` +
          `    - error：后抛出的异常（dispose 异常）\n` +
          `    - suppressed：被抑制的异常（原业务异常）\n` +
          `    - message：描述字符串`;
      } else {
        // DisposableStack 不可用，直接构造 SuppressedError 实例演示
        const original = new Error('original 业务异常');
        const dispose = new Error('dispose 清理异常');
        const se = new SuppressedError(dispose, original, '清理时抑制了业务异常');
        isSuppressed = se instanceof SuppressedError;
        suppressedMsg = se.suppressed.message;
        errorMsg = se.message;
        result =
          `SuppressedError 演示（DisposableStack 不可用，直接构造实例）\n\n` +
          `const original = new Error('original 业务异常');\n` +
          `const dispose = new Error('dispose 清理异常');\n` +
          `const se = new SuppressedError(dispose, original, '清理时抑制了业务异常');\n\n` +
          `se instanceof SuppressedError = ${isSuppressed}\n` +
          `se.message = ${JSON.stringify(errorMsg)}\n` +
          `se.error === dispose = ${se.error === dispose}（后抛出的异常，即 dispose 异常）\n` +
          `se.suppressed === original = ${se.suppressed === original}（被抑制的原业务异常）\n` +
          `se.suppressed.message = ${JSON.stringify(suppressedMsg)}\n\n` +
          `说明：SuppressedError(error, suppressed, message)\n` +
          `  - error：后抛出的异常（通常是 dispose 异常，作为"主"错误）\n` +
          `  - suppressed：被抑制的异常（原业务异常，通过 .suppressed 访问）\n` +
          `  - message：描述字符串\n` +
          `  使用 using/await using 时，运行时自动构造 SuppressedError 包装两个异常。`;
      }
      this.setState({ suppressedResult: result });
      this._addLog('erm', `SuppressedError：instanceof=${isSuppressed}，suppressed=${JSON.stringify(suppressedMsg)}`);
    } catch (err) {
      this._addLog('warn', `SuppressedError 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. SuppressedError + DisposableStack 进阶（ES2025/2026 ERM）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.suppressedError ? 'success' : 'error' }, caps.suppressedError ? 'SuppressedError ✓' : 'SuppressedError ✗'),
        h(Tag, { color: caps.disposableStack ? 'success' : 'error' }, caps.disposableStack ? 'DisposableStack ✓' : 'DisposableStack ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'SuppressedError：using/await using 声明的资源在块结束时自动 [Symbol.dispose]()；若块内抛了"业务异常"，dispose 又抛了"清理异常"，则业务异常被抑制，ES2025 用 new SuppressedError(error, suppressed, message) 把两个异常包装在一起——error 为后抛出的（dispose）异常，suppressed 为被抑制的原业务异常，通过 err.suppressed 访问，避免异常丢失。DisposableStack/using 已在 AdvancedJSRuntimePage 演示，本卡聚焦 SuppressedError 语义。检测：typeof SuppressedError !== "undefined" / typeof DisposableStack !== "undefined"。注意：using 是语法关键字无法运行时 typeof 检测，需编译或原生支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('SuppressedError 演示', { type: 'primary', size: 'sm', onClick: () => this._suppressedErrorDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'SuppressedError 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.suppressedResult || '（点击按钮演示；不可用时将模拟语义并说明）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`// using 声明：块结束时自动 dispose；若同时抛业务异常 + dispose 异常 → SuppressedError
using stack = new DisposableStack();
stack.defer(() => { throw new Error('cleanup failed'); });
throw new Error('business error');
// 捕获到的 err instanceof SuppressedError
// err.suppressed.message === 'business error'（原业务异常被保留）
// err.message === 'cleanup failed'（dispose 异常作为主错误）`)),
        h(Alert, {
          type: 'warning',
          message: 'SuppressedError 解决 try/finally 异常丢失的老问题',
          description: '传统 try/finally 中，若 finally 抛错会"吞掉" try 里的原异常（仅 finally 异常可见，原异常丢失，调试困难）。ES2025 ERM 提案的 SuppressedError 把两个异常包装在一起——err.suppressed 保留原异常，err.error/error 保留后抛出的异常，让异常链完整可追溯。using/await using 是语法关键字无法运行时 typeof 检测，需 TS/Babel/SWC 编译为 try/finally + Symbol.dispose 调用或原生支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：Decorators（TC39 Stage 3）===================

  // Decorators 是语法特性无法 typeof 检测，用普通 JS 手动实现等价行为作对照
  _manualDecorators() {
    try {
      // —— 1. 手动实现 @logged：方法调用前后打印日志 ——
      // 等价装饰器语法：class C { @logged method() {} }
      const logged = (target, context) => {
        const original = target;
        return function (...args) {
          console.log(`[logged] 调用 ${context.name}，参数：${JSON.stringify(args)}`);
          const result = original.apply(this, args);
          console.log(`[logged] ${context.name} 返回：${JSON.stringify(result)}`);
          return result;
        };
      };
      // —— 2. 手动实现 @memoize：缓存函数结果 ——
      const memoize = (target, context) => {
        const original = target;
        const cache = new Map();
        return function (...args) {
          const key = JSON.stringify(args);
          if (cache.has(key)) return cache.get(key);
          const result = original.apply(this, args);
          cache.set(key, result);
          return result;
        };
      };
      // —— 3. 手动实现 @bound：自动 bind this ——
      const bound = (target, context) => {
        const original = target;
        return function (...args) {
          return original.apply(this, args);
        };
        // 真正的 @bound 会用实例字段绑定 this，这里简化为透传
      };
      // —— 用 Object.defineProperty 手动"装饰"类方法（模拟 @logged @memoize）——
      class Calculator {
        add(a, b) { return a + b; }
        fib(n) { return n < 2 ? n : this.fib(n - 1) + this.fib(n - 2); }
      }
      // 手动装饰 add：先 memoize 再 logged（外层先执行）
      const addDesc = Object.getOwnPropertyDescriptor(Calculator.prototype, 'add');
      Calculator.prototype.add = logged(addDesc.value, { name: 'add', kind: 'method' });
      // 手动装饰 fib：memoize 加速递归
      const fibDesc = Object.getOwnPropertyDescriptor(Calculator.prototype, 'fib');
      let fibCalls = 0;
      const originalFib = fibDesc.value;
      // 包装计数 + memoize
      const memoizedFib = memoize(function (n) { fibCalls++; return originalFib.call(this, n); }, { name: 'fib', kind: 'method' });
      Calculator.prototype.fib = memoizedFib;

      const calc = new Calculator();
      const addResult = calc.add(2, 3);              // 5
      // 测试 memoize：调用 fib(10) 多次，递归应被缓存
      const fib1 = calc.fib(10);                      // 55
      const fib2 = calc.fib(10);                      // 55（命中缓存）
      const fib3 = calc.fib(10);                      // 55（命中缓存）
      // —— 4. 装饰器元数据：Symbol.metadata ——
      let metadataInfo = '';
      try {
        const hasMetadata = typeof Symbol !== 'undefined' && typeof Symbol.metadata !== 'undefined';
        metadataInfo =
          `\n装饰器元数据（Symbol.metadata）：\n` +
          `  typeof Symbol.metadata = ${hasMetadata ? 'symbol（已支持）' : 'undefined（ES2025 提案，未实现）'}\n` +
          `  用途：装饰器可通过 metadata 静态字段写入/读取类元数据（如 ORM 字段标注、\n` +
          `  依赖注入标记、序列化配置），运行时通过 Class[Symbol.metadata] 访问。\n` +
          `  示例：class C { @field({ type: 'string' }) name; } → C[Symbol.metadata].name = { type:'string' }`;
      } catch (e) { metadataInfo = `\n元数据检测失败：${e.message}`; }

      this.setState({
        decoratorResult:
          `Decorators 是 TC39 Stage 3 语法特性，无法运行时 typeof 检测\n` +
          `（需 TS 5 / Babel @babel/plugin-proposal-decorators / SWC 编译或原生支持）。\n` +
          `以下用普通 JS 手动实现等价行为（Object.defineProperty + wrapper）作对照。\n\n` +
          `—— 1. 手动 @logged（方法调用前后打印日志）——\n` +
          `const logged = (target, context) => (...args) => {\n` +
          `  console.log(\`[logged] 调用 \${context.name}\`);\n` +
          `  const r = target.apply(this, args);\n` +
          `  console.log(\`[logged] 返回 \${r}\`);\n` +
          `  return r;\n` +
          `};\n` +
          `calc.add(2, 3) = ${addResult}（控制台应见 [logged] 日志）\n\n` +
          `—— 2. 手动 @memoize（缓存函数结果，加速递归）——\n` +
          `const memoize = (target, context) => {\n` +
          `  const cache = new Map();\n` +
          `  return (...args) => {\n` +
          `    const key = JSON.stringify(args);\n` +
          `    return cache.has(key) ? cache.get(key) : cache.set(key, target.apply(this, args)).get(key);\n` +
          `  };\n` +
          `};\n` +
          `calc.fib(10) 第 1 次 = ${fib1}，第 2 次 = ${fib2}，第 3 次 = ${fib3}\n` +
          `  原始 fib 被实际调用 ${fibCalls} 次（无 memoize 时 fib(10) 递归约 177 次）\n\n` +
          `—— 3. 手动 @bound（自动绑定 this）——\n` +
          `const bound = (target, context) => function (...args) { return target.apply(this, args); };\n` +
          `  （真正 @bound 用实例字段绑定，这里简化为透传 this）${metadataInfo}\n\n` +
          `装饰器语法对照（需编译，无法在未支持环境直接运行）：\n` +
          `  class C {\n` +
          `    @logged\n` +
          `    method() {}\n` +
          `    @memoize\n` +
          `    fib(n) { return n<2 ? n : this.fib(n-1)+this.fib(n-2); }\n` +
          `  }\n\n` +
          `说明：装饰器是"语法糖"，编译后等价于上面的 Object.defineProperty + wrapper。\n` +
          `  Stage 3 提案签名：(target, context) => newTarget | void\n` +
          `  context 包含 { name, kind, access, addInitializer, metadata }。\n` +
          `  手动实现可作为不支持环境下的兜底，但失去声明式语法的简洁性。`,
      });
      this._addLog('dec', `手动装饰器：add(2,3)=${addResult}，fib(10)=${fib1}（memoize 后原始调用 ${fibCalls} 次）`);
    } catch (err) {
      this._addLog('warn', `手动装饰器演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const card = new Card({
      title: '6. Decorators（TC39 Stage 3）—— 装饰器语法',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'warning' }, '语法特性 · 无法 typeof'),
        h(Tag, { color: 'primary' }, 'Stage 3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Decorators 是 TC39 Stage 3 语法层面特性，用 @expr 修饰类/方法/字段/getter/setter，编译时展开为高阶函数调用。无法运行时 typeof 检测——需 TS 5（experimentalDecorators 或 Stage 3 草案）、Babel（@babel/plugin-proposal-decorators）、SWC 编译，或原生支持（Stage 3 未全量落地）。装饰器签名：(target, context) => newTarget | void，context 含 { name, kind, access, addInitializer, metadata }。常见装饰器工厂：@logged（日志）、@bound（自动 bind this）、@memoize（缓存结果）。元数据通过 Symbol.metadata 静态字段传递。本页用普通 JS 手动实现等价行为（Object.defineProperty + wrapper）作对照演示。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('手动模拟装饰器', { type: 'primary', size: 'sm', onClick: () => this._manualDecorators() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '手动模拟装饰器结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.decoratorResult || '（点击按钮用普通 JS 手动实现 @logged / @memoize / @bound 等价行为）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '装饰器语法（需编译，无法在未支持环境直接运行）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } },
          h('code', {},
`// 装饰器工厂：返回装饰器函数
function logged(target, { name, kind }) {
  if (kind === 'method') {
    return function (...args) {
      console.log(\`[logged] 调用 \${name}\`);
      const r = target.apply(this, args);
      console.log(\`[logged] 返回 \${r}\`);
      return r;
    };
  }
}
function memoize(target, { name }) {
  const cache = new Map();
  return function (...args) {
    const k = JSON.stringify(args);
    return cache.has(k) ? cache.get(k) : cache.set(k, target.apply(this, args)).get(k);
  };
}
class C {
  @logged method() { return 42; }
  @memoize fib(n) { return n < 2 ? n : this.fib(n-1) + this.fib(n-2); }
}
// 元数据（Symbol.metadata，ES2025 提案）
class D { @field({ type: 'string' }) name; }
D[Symbol.metadata].name; // { type: 'string' }`)),
        h(Alert, {
          type: 'info',
          message: 'Decorators 是语法糖，手动实现可作为不支持环境的兜底',
          description: '装饰器本质是"语法糖"——编译后等价于 Object.defineProperty + wrapper 函数。本页用普通 JS 手动实现 @logged / @memoize / @bound 等价行为，演示装饰器的语义；在不支持装饰器语法的环境（如未启用 TS 5 / Babel 插件的 Node）可作为兜底。Stage 3 装饰器签名 (target, context) => newTarget | void 与 TS 旧版 experimentalDecorators 签名 (target, key, descriptor) 不同，迁移需注意。Symbol.metadata 用于装饰器间传递类元数据（ORM 字段标注、DI 标记等），同为 ES2025 提案。',
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
      h('h2', { class: 'section-title' }, 'ES2025 语言新特性实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 ES2025 提案语言新特性：AsyncIterator Helpers、ShadowRealm、Error.isError、RegExp.escape、Math.f16round/Float16Array、SuppressedError/DisposableStack 进阶、Decorators。多数为 TC39 Stage 3/4 提案，需 Node 22+ / 较新浏览器；Decorators 为语法特性需编译。所有 API 调用前做能力检测，不可用时仅记日志说明，绝不抛异常。'),
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
