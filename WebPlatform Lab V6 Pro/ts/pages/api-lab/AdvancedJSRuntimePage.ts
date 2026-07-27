// =====================================================================
// AdvancedJSRuntimePage.js —— JavaScript 运行时新特性与元编程实验室
// 演示 MDN / JS 特性：
//   Card 1: Proxy 与 Reflect（元编程）
//     - new Proxy(target, handler) 全部 13 个 trap：get/set/has/deleteProperty/ownKeys/
//       apply/construct/getPrototypeOf/setPrototypeOf/defineProperty/getOwnPropertyDescriptor/isExtensible/preventExtensions
//     - Reflect 对象方法（与 Proxy trap 一一对应，返回 boolean 而非抛异常）
//     - Reflect.apply / Reflect.construct 简化函数调用与构造
//   Card 2: Iterator Helpers 与 Symbol.asyncIterator
//     - Iterator.prototype.map/filter/take/drop/toArray/forEach/reduce/some/
//       every/find（ES2025 Iterator Helpers）；Iterator.from(iterable)
//     - Symbol.iterator / Symbol.asyncIterator 协议
//     - Generator function* / yield / yield* 委托
//     - async function* 异步生成器 + for await...of
//   Card 3: Explicit Resource Management（using / await using）
//     - Symbol.dispose / Symbol.asyncDispose
//     - DisposableStack / AsyncDisposableStack（.use/.adopt/.defer/.dispose）
//     - 能力检测 + try/finally 兜底
//   Card 4: Promise 组合与错误处理新特性
//     - Promise.any / Promise.allSettled / Promise.race / Promise.all
//     - AggregateError(errors, message)
//     - Error.cause：new Error('msg', { cause: originalError })
//   Card 5: 数据结构与 API 新方法
//     - Array：at / findLast / findLastIndex / toSorted / toReversed /
//       toSpliced / with / Object.groupBy / Map.groupBy
//     - String：replaceAll / matchAll / at / padStart / padEnd / trimStart / trimEnd
//     - Object：hasOwn / fromEntries
//     - structuredClone / BigInt / BigInt64Array / BigUint64Array /
//       atob / btoa / crypto.randomUUID
// 说明：所有新特性调用前做 typeof / in 能力检测，不可用时记日志说明并回退，
//       不抛异常；componentDidMount 必须守卫避免 OOM 死循环；
//       Proxy/Reflect 演示使用独立 target 对象，避免拦截 _addLog 自身导致无限循环。
// =====================================================================
import { Page } from '../../core/Component.js';

declare const Buffer: any;
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

// —— 模块级生成器与异步生成器（避免在 class 内提升造成的语义混淆）——

// 斐波那契生成器：function* + yield
function* fibGen(n: any) {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// yield* 委托生成器：把多个可迭代对象串联起来
function* delegateGen() {
  yield* [1, 2, 3];
  yield* fibGen(3);
  yield 'end';
}

// 异步生成器：async function* + yield，每隔 delay ms 产出一个值
async function* tickGen(count: any, delay: any = 200) {
  for (let i = 0; i < count; i++) {
    await new Promise((r: any) => setTimeout(r, delay));
    yield i;
  }
}

// Type shims for newer ES globals used as values
declare const Iterator: any;
declare const DisposableStack: any;
declare const AsyncDisposableStack: any;

export interface AdvancedJSRuntimePageProps extends Props {}

export interface AdvancedJSRuntimePageState extends State {}

export class AdvancedJSRuntimePage extends Page {
  declare props: AdvancedJSRuntimePageProps;
  declare state: AdvancedJSRuntimePageState;
  _asyncGenCancel: any = null;
  _asyncGenRunning: boolean = false;
  _disposedStacks: any[] = [];
  _inited: boolean = false;
  initialState(): AdvancedJSRuntimePageState {
    return {
      logs: [],
      proxyResult: '（点击「演示 Proxy 拦截」）',
      reflectResult: '（点击「演示 Reflect 对比 Object」）',
      applyProxyResult: '（点击「演示 apply/construct trap」）',
      iterHelperResult: '（点击「Iterator Helpers」）',
      asyncIterResult: '（点击「运行异步生成器」）',
      ermResult: '（点击「演示 using/DisposableStack」）',
      promiseResult: '（点击对应按钮）',
      errorCauseResult: '（点击「演示 Error.cause」）',
      arrayNewResult: '（点击「Array 新方法」）',
      stringNewResult: '（点击「String 新方法」）',
      miscResult: '（点击「structuredClone/BigInt/UUID」）',
      caps: {
        iteratorHelpers: typeof Iterator !== 'undefined' &&
          typeof Iterator.prototype?.map === 'function',
        iteratorFrom: typeof Iterator !== 'undefined' &&
          typeof Iterator.from === 'function',
        symbolDispose: typeof Symbol !== 'undefined' &&
          typeof Symbol.dispose !== 'undefined',
        symbolAsyncDispose: typeof Symbol !== 'undefined' &&
          typeof Symbol.asyncDispose !== 'undefined',
        disposableStack: typeof DisposableStack !== 'undefined',
        asyncDisposableStack: typeof AsyncDisposableStack !== 'undefined',
        aggregateError: typeof AggregateError !== 'undefined',
        promiseAny: typeof Promise.any === 'function',
        promiseAllSettled: typeof Promise.allSettled === 'function',
        structuredClone: typeof structuredClone === 'function',
        bigInt: typeof BigInt !== 'undefined',
        bigInt64Array: typeof BigInt64Array !== 'undefined',
        randomUUID: typeof crypto !== 'undefined' &&
          typeof crypto.randomUUID === 'function',
        arrayGroup: typeof (Array.prototype as any).group === 'function',
        objectGroupBy: typeof Object !== 'undefined' &&
          typeof Object.groupBy === 'function',
        mapGroupBy: typeof Map !== 'undefined' &&
          typeof Map.groupBy === 'function',
      },
    };
  }

  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount
    // 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    this._asyncGenRunning = false;
    this._asyncGenCancel = null;
    this._disposedStacks = [];

    const c = this.state.caps;
    this._addLog('info', '能力检测：' +
      `Iterator Helpers=${c.iteratorHelpers ? '✓' : '✗'}，` +
      `Symbol.dispose=${c.symbolDispose ? '✓' : '✗'}，` +
      `DisposableStack=${c.disposableStack ? '✓' : '✗'}，` +
      `Promise.any=${c.promiseAny ? '✓' : '✗'}，` +
      `structuredClone=${c.structuredClone ? '✓' : '✗'}，` +
      `BigInt=${c.bigInt ? '✓' : '✗'}，` +
      `crypto.randomUUID=${c.randomUUID ? '✓' : '✗'}`);

    if (!c.iteratorHelpers) this._addLog('warn', 'Iterator Helpers 不可用：将回退到 Array.from + 数组方法');
    if (!c.symbolDispose && !c.disposableStack) this._addLog('warn', 'ERM（using/DisposableStack）部分不可用，将用 try/finally 兜底');
    if (!c.promiseAny) this._addLog('warn', 'Promise.any 不可用（ES2021），将跳过相关演示');
    if (!c.structuredClone) this._addLog('warn', 'structuredClone 不可用，将回退到 JSON 拷贝');
    if (!c.randomUUID) this._addLog('warn', 'crypto.randomUUID 不可用，将回退到 getRandomValues 拼接');
  }

  componentWillUnmount(): void {
    // 清理：取消异步生成器迭代、释放 stack、移除事件监听（on() 自动解绑）
    this._asyncGenRunning = false;
    if (this._asyncGenCancel) {
      try { this._asyncGenCancel(); } catch { /* noop */ }
      this._asyncGenCancel = null;
    }
    // 防御性：主动 dispose 任何仍持有但未释放的 stack
    for (const stack of this._disposedStacks) {
      try { stack.dispose?.(); } catch { /* noop */ }
    }
    this._disposedStacks = [];
  }

  _addLog(type: any, content: any) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _capsBadge(caps: any, key: any, label: any) {
    return h(Tag, { color: caps[key] ? 'success' : 'warning' }, `${label}:${caps[key] ? '✓' : '✗'}`);
  }

  // =================== Card 1: Proxy 与 Reflect ===================

  // 演示 Proxy 拦截 get/set/has/deleteProperty/ownKeys/getOwnPropertyDescriptor。
  // ★ 注意：使用独立 target 对象，handler 内不调用 _addLog，避免无限循环。
  _demoProxyIntercept() {
    const L: any[] = [];
    const target = { name: 'Proxy-Target', count: 0, _internal: 'secret' };
    const accessLog: any[] = []; // 拦截日志先收集到本地数组

    const handler = {
      get(t: any, key: any, receiver: any) {
        const v = Reflect.get(t, key, receiver); // 维持默认（含 getter this 修正）
        accessLog.push(`get ${String(key)} → ${JSON.stringify(v)}`);
        return v;
      },
      set(t: any, key: any, value: any, receiver: any) {
        accessLog.push(`set ${String(key)} = ${JSON.stringify(value)}`);
        return Reflect.set(t, key, value, receiver); // 返回 boolean
      },
      has(t: any, key: any) {
        const r = Reflect.has(t, key);
        accessLog.push(`has ${String(key)} → ${r}`);
        return r;
      },
      deleteProperty(t: any, key: any) {
        accessLog.push(`delete ${String(key)}`);
        return Reflect.deleteProperty(t, key);
      },
      ownKeys(t: any) {
        const keys = Reflect.ownKeys(t);
        accessLog.push(`ownKeys → [${keys.map(String).join(', ')}]`);
        return keys;
      },
      getOwnPropertyDescriptor(t: any, key: any) {
        accessLog.push(`getOwnPropertyDescriptor ${String(key)}`);
        return Reflect.getOwnPropertyDescriptor(t, key);
      },
    };

    const proxy = new Proxy(target, handler);
    void proxy.name;             // get
    proxy.count = 5;             // set
    void ('name' in proxy);      // has
    (Object as any).keys(proxy);          // ownKeys + getOwnPropertyDescriptor
    delete proxy._internal;      // deleteProperty
    Reflect.ownKeys(proxy);      // ownKeys（Reflect 与 Proxy 共用 trap）

    L.push('Proxy 拦截了所有访问，访问日志如下：');
    L.push(...accessLog.map((s: any) => '  • ' + s));
    L.push('', `操作后 target：${JSON.stringify(target)}`);
    L.push(`_internal 是否仍存在：${Object.prototype.hasOwnProperty.call(target, '_internal')}（应已删除）`);
    L.push('说明：每个 trap 内用 Reflect.* 维持默认语义，可在访问前后增强（如日志、校验、缓存）。');
    this.setState({ proxyResult: L.join('\n') });
    this._addLog('mutate', `Proxy 拦截演示完成，记录 ${accessLog.length} 条 trap 访问`);
  }

  // 演示 Reflect 与 Object 静态方法的差异：Reflect 返回 boolean 而非抛异常
  _demoReflectVsObject() {
    const L: any[] = [];
    const obj = Object.preventExtensions({ a: 1 }); // 不可扩展对象

    L.push('—— Reflect.defineProperty vs Object.defineProperty ——');
    const reflectOk = Reflect.defineProperty(obj, 'b', { value: 2 });
    L.push(`Reflect.defineProperty(obj, 'b', {value:2}) → ${reflectOk}（不可扩展，返回 false）`);
    let objectErr = null;
    try { Object.defineProperty(obj, 'c', { value: 3 }); objectErr = '（无异常）'; }
    catch (e: any) { objectErr = e.constructor.name + ': ' + e.message; }
    L.push(`Object.defineProperty(obj, 'c', ...) → 抛 ${objectErr}`, '');

    L.push('—— Reflect.set 失败时返回 false ——');
    L.push(`Reflect.set(obj, 'x', 99) → ${Reflect.set(obj, 'x', 99)}（不可扩展，返回 false）`);
    L.push(`Reflect.has(obj, 'a')     → ${Reflect.has(obj, 'a')}`);
    L.push(`Reflect.get(obj, 'a')     → ${Reflect.get(obj, 'a')}`);
    L.push(`Reflect.ownKeys(obj)      → ${JSON.stringify(Reflect.ownKeys(obj))}`);
    L.push(`Reflect.getPrototypeOf(obj) === Object.prototype → ${Reflect.getPrototypeOf(obj) === Object.prototype}`, '');

    L.push('—— Reflect.apply / Reflect.construct ——');
    function greet(greeting: any, name: any) { return `${greeting}, ${name}!`; }
    L.push(`Reflect.apply(greet, null, ['Hello', 'World']) → ${Reflect.apply(greet, null, ['Hello', 'World'])}`);
    function Person(this: any, name: any) { (this as any).name = name; }
    const p = Reflect.construct(Person, ['Alice']);
    L.push(`Reflect.construct(Person, ['Alice']) → ${JSON.stringify({ name: p.name })}`);
    L.push(`p instanceof Person → ${p instanceof Person}`, '');

    L.push('—— Reflect 其它方法 ——');
    L.push(`Reflect.getOwnPropertyDescriptor(obj, 'a') → ${JSON.stringify(Reflect.getOwnPropertyDescriptor(obj, 'a'))}`);
    L.push(`Reflect.deleteProperty({x:1, y:2}, 'x') → ${Reflect.deleteProperty({ x: 1, y: 2 }, 'x')}`);
    L.push(`Reflect.isExtensible(obj) → ${Reflect.isExtensible(obj)}`);
    L.push(`Reflect.preventExtensions({}) → ${Reflect.preventExtensions({})}`, '');
    L.push('结论：Reflect 方法与 Proxy trap 一一对应，返回 boolean 便于在 trap 内组合默认行为 + 增强逻辑。');
    this.setState({ reflectResult: L.join('\n') });
    this._addLog('info', 'Reflect 对比 Object 演示完成：失败时返回 false 而非抛异常');
  }

  // 演示 apply trap（函数 Proxy）+ construct trap（构造函数 Proxy）
  _demoApplyConstructProxy() {
    const L: any[] = [];
    // apply trap：包装普通函数，添加调用日志
    const originalAdd = function (a: any, b: any) { return a + b; };
    const tracedAdd = new Proxy(originalAdd, {
      apply(target: any, thisArg: any, args: any) {
        const result: any = Reflect.apply(target, thisArg, args);
        L.push(`apply trap: add(${args.join(', ')}) → ${result}（增强前）`);
        return result * 10; // 增强结果
      },
    });
    L.push(`tracedAdd(2, 3) = ${tracedAdd(2, 3)}（apply trap 内 ×10）`);
    L.push(`Reflect.apply(tracedAdd, null, [4, 5]) = ${Reflect.apply(tracedAdd, null, [4, 5])}`, '');

    // construct trap：包装构造函数
    function Gadget(this: any, name: any) { this.name = name; this.kind = 'gadget'; }
    const TracedGadget = new Proxy(Gadget, {
      construct(target: any, args: any, newTarget: any): any {
        const instance: any = Reflect.construct(target, args, newTarget);
        L.push(`construct trap: new Gadget(${args.join(', ')}) → ${JSON.stringify({ name: instance.name, kind: instance.kind })}`);
        instance.traced = true; // 增强：标记
        return instance;
      },
    });
    const g = new TracedGadget('Watch');
    L.push(`new TracedGadget('Watch') → ${JSON.stringify({ name: g.name, kind: g.kind, traced: g.traced })}`);
    L.push(`g instanceof Gadget → ${g instanceof Gadget}`, '');
    L.push('说明：apply / construct trap 配合 Reflect.apply / Reflect.construct，可无侵入地包装函数与类（AOP、日志、缓存）。');
    this.setState({ applyProxyResult: L.join('\n') });
    this._addLog('mutate', 'apply/construct trap 演示完成（函数 Proxy + 构造函数 Proxy）');
  }

  // =================== Card 2: Iterator Helpers 与 async iterator ===================

  _demoIteratorHelpers() {
    const L: any[] = [];
    const c = this.state.caps;

    L.push('—— 1. Generator + for...of ——');
    const fibs: any[] = [];
    for (const v of fibGen(8)) fibs.push(v);
    L.push(`fibGen(8) via for...of → [${fibs.join(', ')}]`);
    L.push(`delegateGen() via yield* → [${[...delegateGen()].join(', ')}]（先数组再生成器再 'end'')`, '');

    L.push('—— 2. Iterator Helpers（ES2025）——');
    if (c.iteratorHelpers && c.iteratorFrom) {
      const processed = Iterator.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        .filter((x: any) => x % 2 === 0)   // 2,4,6,8,10
        .map((x: any) => x * x)            // 4,16,36,64,100
        .drop(1)                      // 16,36,64,100
        .take(3)                      // 16,36,64
        .toArray();
      L.push(`Iterator.from([1..10]).filter(偶).map(平方).drop(1).take(3).toArray() → [${processed.join(', ')}]`);

      let forEachCount = 0;
      Iterator.from(['a', 'b', 'c']).forEach(() => forEachCount++);
      L.push(`forEach 计数 → ${forEachCount}`);
      L.push(`reduce(求和) → ${Iterator.from([1, 2, 3, 4]).reduce((acc: any, x: any) => acc + x, 0)}`);
      L.push(`some(>8) → ${Iterator.from([1, 5, 10]).some((x: any) => x > 8)}`);
      L.push(`every(>0) → ${Iterator.from([1, 2, 3]).every((x: any) => x > 0)}`);
      L.push(`find(偶) → ${Iterator.from([1, 2, 3, 4]).find((x: any) => x % 2 === 0)}`);
      L.push('说明：map/filter/take/drop 返回新 Iterator，惰性求值，toArray/forEach/reduce 才真正消费。');
    } else {
      L.push('Iterator Helpers 不可用，回退到 Array.from + 数组方法：');
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const processed = arr.filter((x: any) => x % 2 === 0).map((x: any) => x * x).slice(1, 4);
      L.push(`Array.from + filter/map/slice → [${processed.join(', ')}]`);
      L.push('注意：数组方法是即时求值，Iterator Helpers 是惰性求值（适合无限序列）。');
    }
    L.push('');

    L.push('—— 3. Symbol.iterator 协议 ——');
    const customIterable = {
      [Symbol.iterator]() {
        let i = 0;
        return {
          next: () => i < 3 ? { value: i++, done: false } : { value: undefined, done: true },
        };
      },
    };
    L.push(`自定义 [Symbol.iterator] → [${[...customIterable].join(', ')}]`);
    L.push(`typeof Iterator → ${typeof Iterator}（${c.iteratorHelpers ? '已实现 Iterator 全局' : '未实现 Iterator 全局（旧环境）'}）`);
    this.setState({ iterHelperResult: L.join('\n') });
    this._addLog('perf', `Iterator Helpers 演示完成（${c.iteratorHelpers ? '原生' : '回退'}）`);
  }

  async _demoAsyncIterator() {
    if (this._asyncGenRunning) {
      this._addLog('warn', '异步生成器正在运行，请等待完成');
      return;
    }
    this._asyncGenRunning = true;
    let cancelled = false;
    this._asyncGenCancel = () => { cancelled = true; };

    const L: any[] = [];
    const collected: any[] = [];
    L.push('—— async function* + for await...of ——', '每 200ms yield 一次，共 5 项：');
    this.setState({ asyncIterResult: L.join('\n') });

    try {
      const supportsAsyncIter = typeof Symbol !== 'undefined' &&
        typeof Symbol.asyncIterator !== 'undefined';
      if (!supportsAsyncIter) {
        L.push('Symbol.asyncIterator 不可用，回退到 Promise 链消费。');
        this.setState({ asyncIterResult: L.join('\n') });
        return;
      }

      // for await...of 会自动 await 每个 Promise，迭代结束时调用 return() 清理
      for await (const v of tickGen(5, 200)) {
        if (cancelled || !this._asyncGenRunning) {
          L.push(`（已取消，最后值=${v}）`);
          break;
        }
        collected.push(v);
        L.push(`  • for await...of 产出：${v}（累计 [${collected.join(', ')}]）`);
        this.setState({ asyncIterResult: L.join('\n') });
        this._addLog('perf', `async generator yield: ${v}`);
      }
      L.push('', `完成：共消费 ${collected.length} 项 → [${collected.join(', ')}]`);
      L.push('说明：for await...of 自动 await 每个 Promise，并在迭代结束/中断时调用生成器 return() 清理。');
    } catch (err: any) {
      L.push(`错误：${err.message}`);
      this._addLog('error', `async iterator 错误：${err.message}`);
    } finally {
      this.setState({ asyncIterResult: L.join('\n') });
      this._asyncGenRunning = false;
      this._asyncGenCancel = null;
    }
  }

  // =================== Card 3: Explicit Resource Management ===================

  _demoERM() {
    const L: any[] = [];
    const c = this.state.caps;

    L.push('—— 1. [Symbol.dispose] 资源（try/finally 兜底，模拟 using 语义）——');
    const makeResource = (label: any) => {
      const openedAt = Date.now();
      const resource: any = {
        label, openedAt, closed: false,
        read() { return this.closed ? null : `data from ${this.label}`; },
      };
      const disposeFn = function (this: any) {
        this.closed = true;
        const tag = c.symbolDispose ? '[Symbol.dispose]' : 'dispose()';
        L.push(`  • ${tag} 调用：${this.label}（开启 ${Date.now() - openedAt}ms）已关闭`);
      };
      if (c.symbolDispose) resource[Symbol.dispose] = disposeFn;
      else resource.dispose = disposeFn;
      return resource;
    };

    // 由于 using 是语法关键字，运行时无法做语法级能力检测；
    // 这里用 try/finally + 显式 dispose 模拟 using 语义。
    {
      const r1 = makeResource('file-handle-1');
      L.push(`  • 开启资源：${r1.label}`, `  • 读取：${r1.read()}`);
      try {
        // 模拟 using r1 = makeResource(...)
      } finally {
        const fn = r1[Symbol.dispose] || r1.dispose;
        fn.call(r1);
      }
    }
    L.push('');

    L.push('—— 2. DisposableStack（.use/.adopt/.defer/.dispose）——');
    if (c.disposableStack) {
      const stack = new DisposableStack();
      this._disposedStacks.push(stack);
      stack.defer(() => L.push('  • defer() 回调：清理临时资源'));
      const conn = makeResource('db-conn');
      stack.use(conn);
      const tmpFile = { name: 'tmp-123', deleted: false };
      stack.adopt(tmpFile, (f: any) => { f.deleted = true; L.push(`  • adopt() 清理：${f.name} 已删除`); });
      L.push(`  • 注册 3 个资源到 stack（defer/use/adopt）`);
      const stackRef = stack;
      stackRef.dispose();
      L.push(`  • stack.dispose() 完成，所有资源已按 LIFO 顺序释放`);
      this._disposedStacks = this._disposedStacks.filter((s: any) => s !== stackRef);
    } else {
      L.push('  DisposableStack 不可用（ES2025/Stage 3，部分浏览器未实现）');
      L.push('  回退：用 try/finally + 手动 dispose 模拟 LIFO 释放');
      const resources = [makeResource('r-a'), makeResource('r-b'), makeResource('r-c')];
      try { L.push(`  • 开启 ${resources.length} 个资源`); }
      finally {
        for (let i = resources.length - 1; i >= 0; i--) {
          const fn = ((resources as any)[(i as any)])[Symbol.dispose] || ((resources as any)[(i as any)]).dispose;
          fn.call(resources[i]);
        }
      }
    }
    L.push('');

    L.push('—— 3. Symbol.asyncDispose / AsyncDisposableStack ——');
    L.push(`  Symbol.asyncDispose 支持：${c.symbolAsyncDispose ? '✓' : '✗'}`);
    L.push(`  AsyncDisposableStack 支持：${c.asyncDisposableStack ? '✓' : '✗'}`);
    if (!c.symbolAsyncDispose && !c.asyncDisposableStack) {
      L.push('  await using / AsyncDisposableStack 是 ES2025/Stage 3 特性，部分浏览器未实现');
      L.push('  异步资源回退：try/finally + await (resource[Symbol.asyncDispose]?.() || resource.dispose())');
    }
    L.push('', '说明：using 声明是语法关键字，运行时无法能力检测；如浏览器不支持，需用 Babel/SWC 编译为 try/finally。',
      '      using r = makeRes(); 等价于 try { ... } finally { r[Symbol.dispose]?.(); }');
    this.setState({ ermResult: L.join('\n') });
    this._addLog('storage', `ERM 演示完成（DisposableStack=${c.disposableStack ? '✓' : '✗'}）`);
  }

  // =================== Card 4: Promise 组合 + Error.cause ===================

  _makePromises() {
    const make = (label: any, ok: any, delay: any = 100 + Math.random() * 400) =>
      new Promise((resolve: any, reject: any) =>
        setTimeout(() => ok ? resolve(`${label}✓`) : reject(new Error(`${label}✗`)), delay)
      );
    return [make('A', false), make('B', false), make('C', true)];
  }

  async _runPromiseAny() {
    if (!this.state.caps.promiseAny) { this._addLog('warn', 'Promise.any 不可用（ES2021）'); return; }
    this._addLog('info', 'Promise.any 开始（2 reject + 1 fulfill，返回第一个 fulfill）');
    try {
      const res = await Promise.any(this._makePromises());
      this.setState({ promiseResult: `Promise.any 成功：${res}\n（任一 fulfill 即返回，忽略所有 reject）` });
      this._addLog('info', `Promise.any → ${res}`);
    } catch (err: any) {
      this.setState({ promiseResult: `Promise.any 失败：${err.message}` });
      this._addLog('error', `Promise.any 错误：${err.message}`);
    }
  }

  async _runPromiseAllSettled() {
    if (!this.state.caps.promiseAllSettled) { this._addLog('warn', 'Promise.allSettled 不可用'); return; }
    this._addLog('info', 'Promise.allSettled 开始（等所有 settle，返回 {status, value/reason}）');
    const res = await Promise.allSettled(this._makePromises());
    const text = res.map((r: any, i: any) =>
      r.status === 'fulfilled' ? `  #${i + 1} fulfilled → ${r.value}` : `  #${i + 1} rejected  → ${r.reason.message}`
    ).join('\n');
    this.setState({ promiseResult: `Promise.allSettled 结果：\n${text}` });
    this._addLog('info', `Promise.allSettled 完成（${res.length} 项）`);
  }

  async _runPromiseAnyAllReject() {
    if (!this.state.caps.promiseAny || !this.state.caps.aggregateError) {
      this._addLog('warn', 'Promise.any 或 AggregateError 不可用'); return;
    }
    this._addLog('info', 'Promise.any（3 个全 reject）开始，预期抛 AggregateError');
    const allReject = ['X1', 'X2', 'X3'].map((l: any) =>
      new Promise((_: any, rej: any) => setTimeout(() => rej(new Error(l + ' 失败')), 80 + Math.random() * 300))
    );
    try {
      await Promise.any(allReject);
      this.setState({ promiseResult: '未抛异常（不应发生）' });
    } catch (err: any) {
      const reasons = (err.errors || []).map((e: any) => e.message).join(', ');
      this.setState({
        promiseResult:
          `AggregateError 触发！\n` +
          `  err instanceof AggregateError = ${err instanceof AggregateError}\n` +
          `  err.message = ${err.message}\n` +
          `  err.errors.length = ${err.errors?.length}\n` +
          `  err.errors = [${reasons}]\n` +
          `说明：Promise.any 在所有 Promise 都 reject 时抛 AggregateError（errors 是失败原因数组）`,
      });
      this._addLog('error', `AggregateError：[${reasons}]`);
    }
  }

  _demoErrorCause() {
    const L: any[] = [];
    L.push('—— Error.cause（ES2022）——');
    try {
      try {
        throw new Error('数据库连接超时');
      } catch (originalErr: any) {
        const wrapped: any = new Error('保存用户失败', { cause: originalErr });
        L.push(`原始错误：${originalErr.message}`);
        L.push(`包装错误：${wrapped.message}`);
        L.push(`wrapped.cause === originalErr → ${wrapped.cause === originalErr}`);
        L.push(`wrapped.cause.message → ${wrapped.cause.message}`);
        const outer = new Error('请求处理失败', { cause: wrapped });
        L.push('', '错误链遍历（outer → wrapped → original）：');
        let cursor: any = outer, depth = 0;
        while (cursor) {
          L.push(`  ${'  '.repeat(depth)}↳ ${cursor.message}`);
          cursor = cursor.cause;
          depth++;
          if (depth > 5) break; // 防御性
        }
        throw outer;
      }
    } catch (err: any) {
      L.push('', `最外层 catch 捕获：${err.message}`);
      let n = 0, e = err;
      while (e) { n++; e = e.cause; if (n > 10) break; }
      L.push(`错误链深度：${n}`);
    }
    this.setState({ errorCauseResult: L.join('\n') });
    this._addLog('error', 'Error.cause 错误链演示完成');
  }

  // =================== Card 5: 数据结构与 API 新方法 ===================

  _demoArrayNew() {
    const L: any[] = [];
    const c = this.state.caps;
    const arr = [3, 1, 4, 1, 5, 9, 2, 6, 8];

    L.push('—— Array.prototype.at ——', `arr = [${arr.join(', ')}]`);
    L.push(`arr.at(-1) = ${arr.at(-1)}（末尾）`, `arr.at(-2) = ${arr.at(-2)}`, `arr.at(0)  = ${arr.at(0)}`, '');

    L.push('—— findLast / findLastIndex（ES2023）——');
    if (typeof arr.findLast === 'function') {
      L.push(`arr.findLast(偶数)      = ${arr.findLast((x) => x % 2 === 0)}`);
      L.push(`arr.findLastIndex(偶数) = ${arr.findLastIndex((x) => x % 2 === 0)}`);
    } else {
      L.push('findLast/findLastIndex 不可用，回退到 reverse + find');
      L.push(`reversed.find(偶数) = ${[...arr].reverse().find((x) => x % 2 === 0)}`);
    }
    L.push('');

    L.push('—— 不可变方法 toSorted/toReversed/toSpliced/with（ES2023）——');
    if (typeof arr.toSorted === 'function') {
      L.push(`arr.toSorted(升序) = [${arr.toSorted((a, b) => a - b).join(', ')}]`);
      L.push(`arr.toReversed()   = [${arr.toReversed().join(', ')}]`);
      L.push(`arr.toSpliced(0,2) = [${arr.toSpliced(0, 2).join(', ')}]`);
      L.push(`arr.with(0, 99)    = [${arr.with(0, 99).join(', ')}]`);
      L.push(`原数组保持不变：    [${arr.join(', ')}]（与 sort/reverse/splice 对比，后者会原地修改）`);
    } else {
      L.push('toSorted/toReversed/toSpliced/with 不可用，回退到 slice + 排序');
      L.push(`slice().sort() = [${arr.slice().sort((a, b) => a - b).join(', ')}]，原数组不变`);
    }
    L.push('');

    L.push('—— group / Object.groupBy / Map.groupBy（ES2024）——');
    const nums = [1, 2, 3, 4, 5, 6];
    if (c.objectGroupBy) {
      L.push(`Object.groupBy(奇偶) = ${JSON.stringify(Object.groupBy(nums, (x) => (x % 2 ? 'odd' : 'even')))}`);
    } else {
      L.push('Object.groupBy 不可用，回退到 reduce：');
      const grouped = nums.reduce((acc: any, x: any) => {
        const k = x % 2 ? 'odd' : 'even';
        (acc[k] ||= []).push(x);
        return acc;
      }, {});
      L.push(`reduce 分组 = ${JSON.stringify(grouped)}`);
    }
    if (c.mapGroupBy) {
      const mg = Map.groupBy(nums, (x: any) => (x % 2 ? 'odd' : 'even'));
      L.push(`Map.groupBy size = ${mg.size}，keys=[${[...(mg as any).keys()].join(', ')}]`);
    }
    if (c.arrayGroup) {
      L.push(`Array.prototype.group 可用：${JSON.stringify((nums as any).group((x: any) => (x % 2 ? 'odd' : 'even')))}`);
    } else {
      L.push('Array.prototype.group 不可用（已被 Object.groupBy/Map.groupBy 取代）');
    }
    this.setState({ arrayNewResult: L.join('\n') });
    this._addLog('mutate', 'Array 新方法演示完成');
  }

  _demoStringNew() {
    const L: any[] = [];
    L.push('—— String.prototype.replaceAll（ES2021）——');
    L.push(`'banana'.replaceAll('a', 'A') = ${'banana'.replaceAll('a', 'A')}`);
    L.push(`'a-b-c-d'.replaceAll('-', '/') = ${'a-b-c-d'.replaceAll('-', '/')}`);
    L.push(`（replaceAll 必须用 g 标志的正则，否则抛异常；字符串则全局替换）`, '');

    L.push('—— String.prototype.matchAll（ES2020）——');
    const str = '订单 #1001 共 $25.99，订单 #1002 共 $8.50';
    const matches = [...str.matchAll(/#(\d+)\s.*?\$(\d+\.\d{2})/g)];
    L.push(`源串：${str}`, `matchAll 命中 ${matches.length} 组：`);
    matches.forEach((m: any, i: any) => L.push(`  #${i + 1} 完整="${m[0]}"，订单号=${m[1]}，金额=${m[2]}`));
    L.push('');

    L.push('—— at / padStart / padEnd ——');
    L.push(`'hello'.at(-1) = ${'hello'.at(-1)}`);
    L.push(`'5'.padStart(3, '0') = ${'5'.padStart(3, '0')}`);
    L.push(`'5'.padEnd(3, '_')   = ${'5'.padEnd(3, '_')}`);
    L.push(`'5'.padStart(4, 'ab') = ${'5'.padStart(4, 'ab')}（填充串循环使用）`, '');

    L.push('—— trimStart / trimEnd ——');
    L.push(`'  hi  '.trimStart() = "${'  hi  '.trimStart()}"`);
    L.push(`'  hi  '.trimEnd()   = "${'  hi  '.trimEnd()}"`);
    L.push(`（trimStart/trimEnd 别名 trimLeft/trimRight）`);
    this.setState({ stringNewResult: L.join('\n') });
    this._addLog('info', 'String 新方法演示完成');
  }

  _demoMisc() {
    const L: any[] = [];
    const c = this.state.caps;

    L.push('—— Object.hasOwn / Object.fromEntries ——');
    const protoless = Object.create(null);
    protoless.foo = 'bar';
    L.push(`Object.hasOwn(protoless, 'foo') = ${Object.hasOwn(protoless, 'foo')}（比 hasOwnProperty 安全）`);
    L.push(`protoless.hasOwnProperty 可用？ ${typeof protoless.hasOwnProperty === 'function'}（无原型对象上不存在）`);
    const entries: [string, number][] = [['a', 1], ['b', 2], ['c', 3]];
    L.push(`Object.fromEntries([['a',1],...]) = ${JSON.stringify(Object.fromEntries(entries))}`);
    L.push(`Map ↔ Object 互转：new Map(entries) → Object.fromEntries(map)`);
    const m = new Map(entries);
    L.push(`  new Map(entries).size = ${m.size}`, `  Object.fromEntries(new Map(entries)) = ${JSON.stringify(Object.fromEntries(m))}`, '');

    L.push('—— structuredClone（深拷贝）——');
    if (c.structuredClone) {
      const original = {
        date: new Date('2025-01-01'), regex: /test/gi,
        map: new Map([['k', 'v']]), set: new Set([1, 2, 3]),
        buf: new ArrayBuffer(8), nested: { a: [1, 2, { b: true }] },
      };
      const cloned = structuredClone(original);
      L.push(`structuredClone 成功`);
      L.push(`  cloned.date instanceof Date   → ${cloned.date instanceof Date}，值=${cloned.date.toISOString()}`);
      L.push(`  cloned.map instanceof Map    → ${cloned.map instanceof Map}，size=${cloned.map.size}`);
      L.push(`  cloned.set instanceof Set    → ${cloned.set instanceof Set}，size=${cloned.set.size}`);
      L.push(`  (cloned.buf as any).byteLength        → ${(cloned.buf as any).byteLength}`);
      L.push(`  深拷贝独立：cloned.nested !== original.nested → ${cloned.nested !== original.nested}`);
      try { structuredClone({ fn: () => 1 }); }
      catch (err: any) { L.push(`  structuredClone({fn}) 抛异常：${err.message}（不支持函数/DOM 节点等）`); }
    } else {
      L.push('structuredClone 不可用，回退到 JSON.parse(JSON.stringify)（丢失 Date/Map/Set/RegExp 类型信息）');
    }
    L.push('');

    L.push('—— BigInt / BigInt64Array / BigUint64Array ——');
    if (c.bigInt) {
      const big = 9007199254740993n; // Number.MAX_SAFE_INTEGER + 2
      L.push(`9007199254740993n（MAX_SAFE_INTEGER+2）= ${big}`, `typeof big = ${typeof big}`);
      L.push(`2n ** 64n = ${(2n ** 64n).toString()}`);
      L.push(`BigInt('12345678901234567890') = ${BigInt('12345678901234567890')}`);
      if (c.bigInt64Array) {
        const i64 = new BigInt64Array(3);
        i64[0] = -10n; i64[1] = 100n; i64[2] = 9223372036854775807n;
        L.push(`BigInt64Array(3) = [${i64.join(', ')}]（有符号 64 位）`);
        const u64 = new BigUint64Array([0n, 1n, 18446744073709551615n]);
        L.push(`BigUint64Array(3) = [${u64.join(', ')}]（无符号 64 位）`);
      }
      L.push(`注意：BigInt 不能与 Number 直接运算（1n + 1 抛 TypeError），需显式转换`);
    } else {
      L.push('BigInt 不可用');
    }
    L.push('');

    L.push('—— atob / btoa（Base64 编解码）——');
    if (typeof btoa === 'function' && typeof atob === 'function') {
      const text = 'Hello, World!';
      L.push(`原文：${text}`, `btoa → ${btoa(text)}`, `atob → ${atob(btoa(text))}`);
      const zh = '你好，世界！';
      const zhEncoded = btoa(unescape(encodeURIComponent(zh)));
      L.push(`中文 "${zh}" → ${zhEncoded} → ${decodeURIComponent(escape(atob(zhEncoded)))}`);
    } else {
      L.push('atob/btoa 不可用（Node.js 中需 Buffer.from/toString）');
    }
    L.push('');

    L.push('—— crypto.randomUUID（UUID v4）——');
    if (c.randomUUID) {
      const uuids = Array.from({ length: 5 }, () => crypto.randomUUID());
      L.push('生成 5 个 UUID v4：');
      uuids.forEach((u: any, i: any) => L.push(`  ${i + 1}. ${u}`));
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      L.push(`全部符合 UUID v4 格式：${uuids.every((u) => uuidRe.test(u))}`);
      L.push(`唯一性：${new Set(uuids).size === uuids.length}`);
    } else {
      L.push('crypto.randomUUID 不可用，回退到 crypto.getRandomValues + 拼接：');
      const fallback = () => {
        const b = crypto.getRandomValues!(new Uint8Array(16));
        b[6] = (b[6] & 0x0f) | 0x40; // version 4
        b[8] = (b[8] & 0x3f) | 0x80; // variant 10
        const h = [...b].map((x: any) => x.toString(16).padStart(2, '0'));
        return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
      };
      for (let i = 0; i < 5; i++) L.push(`  ${i + 1}. ${fallback()}`);
    }
    this.setState({ miscResult: L.join('\n') });
    this._addLog('crypto', `structuredClone/BigInt/UUID 演示完成（randomUUID=${c.randomUUID ? '✓' : '回退'}）`);
  }

  // =================== 渲染 ===================

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log: any) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  renderPage(): Node | string | (Node | string)[] {
    const s = this.state;
    const c = s.caps;

    return [
      h('h2', { class: 'section-title' }, 'JavaScript 运行时新特性与元编程实验室'),

      h(Alert, {
        type: 'info',
        message: 'Proxy/Reflect · Iterator Helpers · using/DisposableStack · Promise 组合 + Error.cause · Array/String/Object 新方法 + structuredClone/BigInt/UUID',
        description: '五大主题覆盖 ES2020-2025 运行时新特性与元编程。所有新特性调用前做能力检测，不可用时记日志说明并回退；操作日志统一显示在底部日志面板。',
      }),

      h(Alert, {
        type: 'warning',
        message: '浏览器兼容性提示',
        description: 'Iterator Helpers / using / DisposableStack 是 ES2025/Stage 3 特性，部分浏览器（含 Node.js 早期版本）尚未实现，将自动回退到等价实现。其它特性（Proxy、Reflect、Promise.any、Error.cause、structuredClone、BigInt、crypto.randomUUID）在 2022+ 浏览器已普遍支持。',
      }),

      // ============ Card 1: Proxy 与 Reflect ============
      h(Card, {
        title: 'Card 1. Proxy 与 Reflect（元编程）',
        extra: h('div', { class: 'flex items-center gap-xs flex-wrap' },
          h(Tag, { color: 'success' }, 'Proxy:稳定'),
          h(Tag, { color: 'success' }, 'Reflect:稳定'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'new Proxy(target, handler) 提供 13 个 trap（get/set/has/deleteProperty/ownKeys/apply/construct/getPrototypeOf/setPrototypeOf/defineProperty/getOwnPropertyDescriptor/isExtensible/preventExtensions）。Reflect 与 Proxy trap 一一对应，方法返回 boolean 而非抛异常，便于在 trap 内组合默认行为 + 增强。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('演示 Proxy 拦截', { type: 'primary', size: 'sm', onClick: () => this._demoProxyIntercept() }),
            this._btn('Reflect 对比 Object', { type: 'primary', size: 'sm', onClick: () => this._demoReflectVsObject() }),
            this._btn('apply/construct trap', { type: 'primary', size: 'sm', onClick: () => this._demoApplyConstructProxy() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, 'Proxy 拦截 get/set/has/delete/ownKeys：'),
          h('pre', { class: 'code-block' }, s.proxyResult),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Reflect vs Object（返回 boolean vs 抛异常）：'),
          h('pre', { class: 'code-block' }, s.reflectResult),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'apply trap（函数 Proxy）+ construct trap（构造函数 Proxy）：'),
          h('pre', { class: 'code-block' }, s.applyProxyResult),
        ),
      ),

      // ============ Card 2: Iterator Helpers 与 async iterator ============
      h(Card, {
        title: 'Card 2. Iterator Helpers 与 Symbol.asyncIterator',
        extra: h('div', { class: 'flex items-center gap-xs flex-wrap' },
          this._capsBadge(c, 'iteratorHelpers', 'Helpers'),
          this._capsBadge(c, 'iteratorFrom', 'Iterator.from'),
          h(Tag, { color: c.iteratorHelpers ? 'success' : 'warning' }, c.iteratorHelpers ? 'ES2025' : '回退'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Iterator Helpers（ES2025）：iterator.map/filter/take/drop/toArray/forEach/reduce/some/every/find 链式惰性求值；Iterator.from(iterable) 静态方法。Generator 用 function* + yield，yield* 委托；async function* + for await...of 处理异步迭代。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('Iterator Helpers', { type: 'primary', size: 'sm', onClick: () => this._demoIteratorHelpers() }),
            this._btn('运行异步生成器', { type: 'primary', size: 'sm', onClick: () => this._demoAsyncIterator() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, 'Generator + Iterator Helpers：'),
          h('pre', { class: 'code-block' }, s.iterHelperResult),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'async function* + for await...of：'),
          h('pre', { class: 'code-block' }, s.asyncIterResult),
        ),
      ),

      // ============ Card 3: Explicit Resource Management ============
      h(Card, {
        title: 'Card 3. Explicit Resource Management（using / await using）',
        extra: h('div', { class: 'flex items-center gap-xs flex-wrap' },
          this._capsBadge(c, 'symbolDispose', 'Symbol.dispose'),
          this._capsBadge(c, 'disposableStack', 'DisposableStack'),
          h(Tag, { color: c.disposableStack ? 'success' : 'warning' }, c.disposableStack ? 'ES2025' : 'Stage 3'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'using 声明绑定 [Symbol.dispose]() 资源，离开作用域自动释放；await using 绑定 [Symbol.asyncDispose]()；DisposableStack/AsyncDisposableStack 提供 .use()/.adopt()/.defer()/.dispose() 集中管理。由于 using 是语法关键字，运行时无法能力检测，回退到 try/finally + 手动 dispose。'),
          this._btn('演示 using/DisposableStack', { type: 'primary', size: 'sm', onClick: () => this._demoERM() }),
          h('pre', { class: 'code-block' }, s.ermResult),
        ),
      ),

      // ============ Card 4: Promise 组合与错误处理 ============
      h(Card, {
        title: 'Card 4. Promise 组合与错误处理新特性',
        extra: h('div', { class: 'flex items-center gap-xs flex-wrap' },
          this._capsBadge(c, 'promiseAny', 'Promise.any'),
          this._capsBadge(c, 'aggregateError', 'AggregateError'),
          h(Tag, { color: 'success' }, 'Error.cause:稳定'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Promise.any：任一 fulfill 即返回，全 reject 抛 AggregateError；Promise.allSettled：等所有 settle 返回 {status, value/reason}；AggregateError.errors 是失败原因数组；Error.cause（ES2022）保留原始错误链，便于层层包装定位根因。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('Promise.any（2拒1成）', { type: 'primary', size: 'sm', onClick: () => this._runPromiseAny() }),
            this._btn('Promise.allSettled', { type: 'primary', size: 'sm', onClick: () => this._runPromiseAllSettled() }),
            this._btn('any(全拒→AggregateError)', { danger: true, size: 'sm', onClick: () => this._runPromiseAnyAllReject() }),
            this._btn('演示 Error.cause', { type: 'primary', size: 'sm', onClick: () => this._demoErrorCause() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, 'Promise 组合结果：'),
          h('pre', { class: 'code-block' }, s.promiseResult),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Error.cause 错误链：'),
          h('pre', { class: 'code-block' }, s.errorCauseResult),
        ),
      ),

      // ============ Card 5: 数据结构与 API 新方法 ============
      h(Card, {
        title: 'Card 5. 数据结构与 API 新方法',
        extra: h('div', { class: 'flex items-center gap-xs flex-wrap' },
          this._capsBadge(c, 'structuredClone', 'structuredClone'),
          this._capsBadge(c, 'randomUUID', 'UUID'),
          h(Tag, { color: 'success' }, 'Array/String:ES2021-2024'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Array：at/findLast/findLastIndex/toSorted/toReversed/toSpliced/with/Object.groupBy/Map.groupBy；String：replaceAll/matchAll/at/padStart/padEnd/trimStart/trimEnd；Object：hasOwn/fromEntries；其它：structuredClone/BigInt/BigInt64Array/atob/btoa/crypto.randomUUID。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('Array 新方法', { type: 'primary', size: 'sm', onClick: () => this._demoArrayNew() }),
            this._btn('String 新方法', { type: 'primary', size: 'sm', onClick: () => this._demoStringNew() }),
            this._btn('structuredClone/BigInt/UUID', { type: 'primary', size: 'sm', onClick: () => this._demoMisc() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, 'Array 新方法：'),
          h('pre', { class: 'code-block' }, s.arrayNewResult),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'String 新方法：'),
          h('pre', { class: 'code-block' }, s.stringNewResult),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'structuredClone / BigInt / UUID：'),
          h('pre', { class: 'code-block' }, s.miscResult),
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
