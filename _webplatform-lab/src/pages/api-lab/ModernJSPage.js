// ModernJSPage.js —— 现代 ES2020-2024 特性实验室
// 演示 MDN：WeakRef/FinalizationRegistry、Iterator/Generator/async iteration、
//           Promise 组合器、新数组方法、Object/String/Number 新方法、
//           Map/Set/WeakMap/WeakSet、逻辑赋值与空值合并、顶层 await + 动态 import
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import { Input } from '../../components/ui/Input.js';

// —— 模块级 Generator 函数 ——
// 斐波那契数列生成器：function* + yield
function* fib(count) {
  let a = 0, b = 1;
  for (let i = 0; i < count; i++) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// range 生成器
function* range(start, end, step = 1) {
  for (let i = start; i < end; i += step) yield i;
}

// yield* 委托生成器：把多个可迭代对象串联起来
function* delegate() {
  yield* range(1, 3);     // 委托给 range 生成器
  yield* ['a', 'b'];      // 委托给数组
  yield 'end';            // 自身产出
}

export class ModernJSPage extends Page {
  initialState() {
    return {
      logs: [],
      weakRefResult: '尚未创建 WeakRef',
      gcTriggered: false,
      iterResults: [],
      generatorResults: [],
      asyncIterResults: [],
      promiseAllResult: '',
      promiseRaceResult: '',
      promiseAllSettledResult: '',
      promiseAnyResult: '',
      arrayMethodDemo: '',
      objectStringDemo: '',
      mapSetDemo: '',
      logicDemo: '',
      dynamicImportResult: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // FinalizationRegistry：注册回调，当目标对象被 GC 回收时触发
    try {
      this._registry = new FinalizationRegistry((heldValue) => {
        this.setState({ gcTriggered: true });
        this._addLog('storage', `FinalizationRegistry 回调触发，已回收对象标签：${heldValue}`);
      });
      this._addLog('storage', 'FinalizationRegistry 已就绪（等待对象被回收）');
    } catch (err) {
      this._addLog('error', `FinalizationRegistry 不可用：${err.message}`);
    }
  }

  componentWillUnmount() {
    // 解除强引用，便于 GC；释放 registry 引用
    this._target = null;
    this._weakRef = null;
    this._registry = null;
  }

  // —— 日志辅助 ——
  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  // —— 按钮辅助 ——
  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // =================== 1. WeakRef + FinalizationRegistry ===================
  _createWeakRef() {
    // 创建一个大对象并用 WeakRef 包装（弱引用，不阻止其被 GC）
    const bigObj = {
      name: 'BigCache-' + Date.now(),
      data: new Array(10000).fill(0).map((_, i) => i),
    };
    this._target = bigObj;                   // 强引用（页面持有）
    this._weakRef = new WeakRef(bigObj);     // 弱引用
    // 注册到 FinalizationRegistry：bigObj 被 GC 时回调，heldValue='bigObj'
    this._registry?.register(bigObj, 'bigObj');
    const deref = this._weakRef.deref();
    this.setState({
      weakRefResult: `已创建 WeakRef（包装大对象 ${bigObj.name}，含 ${bigObj.data.length} 项）\n` +
        `weakRef.deref() → ${deref ? deref.name : 'undefined'}\n` +
        `说明：WeakRef 用于缓存，FinalizationRegistry 用于资源清理`,
      gcTriggered: false,
    });
    this._addLog('storage', `创建 WeakRef，deref()=${deref ? '对象(' + deref.name + ')' : 'undefined'}`);
  }

  _checkWeakRef() {
    if (!this._weakRef) {
      this._addLog('error', '请先点击「创建 WeakRef」');
      return;
    }
    // WeakRef.deref() 返回对象（仍存活）或 undefined（已被 GC）
    const obj = this._weakRef.deref();
    const msg = obj ? `deref() → 对象「${obj.name}」（仍存活）` : 'deref() → undefined（已被 GC 回收）';
    this._addLog('storage', '检查：' + msg);
    this.setState({
      weakRefResult: this.state.weakRefResult + '\n[检查] ' + msg,
      gcTriggered: obj ? this.state.gcTriggered : true,
    });
  }

  _tryGc() {
    // 主动解除强引用；GC 无法手动触发，只能等待
    this._target = null;
    this._addLog('storage', '已解除强引用（_target=null）。GC 不可手动触发，请切换标签页或等待后再「检查」');
    // 部分 Node 环境可用 --expose-gc 暴露全局 gc()，浏览器一般无此函数
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
      this._addLog('storage', '检测到 gc()，已尝试主动触发');
    }
  }

  // =================== 2. Iterator / Generator / async iteration ===================
  _runIterators() {
    // 自定义可迭代对象：实现 Symbol.iterator 协议
    const iterable = {
      data: [10, 20, 30],
      [Symbol.iterator]() {
        const data = this.data;
        let i = 0;
        return {
          next: () => i < data.length
            ? { value: data[i++], done: false }
            : { value: undefined, done: true },
        };
      },
    };
    // 用 for...of 遍历自定义可迭代对象
    const result = [];
    for (const v of iterable) result.push(v);
    this.setState({ iterResults: result });
    this._addLog('perf', `自定义 Iterator（Symbol.iterator）遍历结果：[${result.join(', ')}]`);
  }

  _runGenerators() {
    const fibs = [...fib(10)];          // 0,1,1,2,3,5,8,13,21,34
    const ranges = [...range(1, 6)];    // 1,2,3,4,5
    const delegated = [...delegate()];  // 1,2,a,b,end
    this.setState({
      generatorResults: [
        { name: 'fib(10)', values: fibs },
        { name: 'range(1,6)', values: ranges },
        { name: 'yield* 委托', values: delegated },
      ],
    });
    this._addLog('perf', `Generator：fib(10)=${fibs.join(',')}；yield* 委托=${delegated.join(',')}`);
  }

  async _runAsyncIter() {
    // 自定义 async iterator：Symbol.asyncIterator + 返回 Promise 的 next()
    const asyncIterable = {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          next: () => new Promise((resolve) => {
            setTimeout(() => {
              if (i < 3) resolve({ value: i++, done: false });
              else resolve({ value: undefined, done: true });
            }, 120);
          }),
        };
      },
    };
    const result = [];
    // for await...of 遍历异步可迭代对象
    for await (const v of asyncIterable) {
      result.push(v);
      this._addLog('perf', `async iteration 产出：${v}`);
    }
    this.setState({ asyncIterResults: result });
    this._addLog('perf', `async iterator 完成，结果：[${result.join(', ')}]`);
  }

  // =================== 3. Promise 组合器 ===================
  // 生成 4 个随机延迟 Promise（100-1000ms）：P1/P3 resolve，P2/P4 reject
  _makePromises() {
    const make = (label, shouldResolve) =>
      new Promise((resolve, reject) => {
        const delay = 100 + Math.floor(Math.random() * 900);
        setTimeout(() => {
          if (shouldResolve) resolve(`${label}✓(${delay}ms)`);
          else reject(new Error(`${label}✗(${delay}ms)`));
        }, delay);
      });
    return [make('P1', true), make('P2', false), make('P3', true), make('P4', false)];
  }

  async _runPromiseAll() {
    this._addLog('crypto', 'Promise.all 开始（任一 reject 即整体 reject）');
    try {
      const res = await Promise.all(this._makePromises());
      this.setState({ promiseAllResult: `全部成功：\n${JSON.stringify(res, null, 2)}` });
    } catch (err) {
      this.setState({ promiseAllResult: `失败（任一 reject 即整体失败）：${err.message}` });
      this._addLog('error', `Promise.all 失败：${err.message}`);
    }
  }

  async _runPromiseRace() {
    this._addLog('crypto', 'Promise.race 开始（第一个完成即结束，无论成功失败）');
    try {
      const res = await Promise.race(this._makePromises());
      this.setState({ promiseRaceResult: `第一个完成（成功）：${res}` });
    } catch (err) {
      this.setState({ promiseRaceResult: `第一个完成（失败）：${err.message}` });
    }
  }

  async _runPromiseAllSettled() {
    this._addLog('crypto', 'Promise.allSettled 开始（等待全部完成，返回 {status, value/reason}）');
    const res = await Promise.allSettled(this._makePromises());
    const text = res.map((r, i) => {
      if (r.status === 'fulfilled') return `#${i + 1} fulfilled → ${r.value}`;
      return `#${i + 1} rejected  → ${r.reason.message}`;
    }).join('\n');
    this.setState({ promiseAllSettledResult: text });
  }

  async _runPromiseAny() {
    this._addLog('crypto', 'Promise.any 开始（第一个成功；全失败抛 AggregateError）');
    try {
      const res = await Promise.any(this._makePromises());
      this.setState({ promiseAnyResult: `第一个成功：${res}` });
    } catch (err) {
      // 全部失败时抛 AggregateError，err.errors 为失败原因数组
      const reasons = (err.errors || []).map((e) => e.message).join(', ');
      this.setState({ promiseAnyResult: `AggregateError：全部失败（共 ${err.errors?.length} 个）\nerrors: [${reasons}]` });
      this._addLog('error', `AggregateError：${reasons}`);
    }
  }

  // 演示全部 reject 时 Promise.any 抛出 AggregateError
  async _runPromiseAnyAllReject() {
    this._addLog('crypto', 'Promise.any（4 个全 reject）开始，预期抛 AggregateError');
    const allReject = ['E1', 'E2', 'E3', 'E4'].map((label) =>
      new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' 失败')), 100 + Math.random() * 400))
    );
    try {
      await Promise.any(allReject);
    } catch (err) {
      const reasons = (err.errors || []).map((e) => e.message).join(', ');
      this.setState({
        promiseAnyResult: `AggregateError：全部失败（共 ${err.errors?.length} 个）\n` +
          `errors: [${reasons}]\n` +
          `err instanceof AggregateError = ${err instanceof AggregateError}`,
      });
      this._addLog('error', `AggregateError 触发，errors.length=${err.errors?.length}：[${reasons}]`);
    }
  }

  // =================== 4. 新数组方法 ===================
  _runArrayMethods() {
    const arr = [3, 1, 4, 1, 5, 9, 2, 6];
    const nestedArr = [1, [2, [3, [4]]]];
    const L = [];
    // at(-1)：负索引取值
    L.push(`arr.at(-1) = ${arr.at(-1)}  // 末尾元素`);
    L.push(`arr.at(0)  = ${arr.at(0)}`);
    // flat(n)：数组扁平化
    L.push(`[1,[2,[3,[4]]]].flat(1)        = ${JSON.stringify(nestedArr.flat(1))}`);
    L.push(`[1,[2,[3,[4]]]].flat(Infinity) = ${JSON.stringify(nestedArr.flat(Infinity))}`);
    // flatMap：map + flat(1)
    L.push(`flatMap(split) = ${JSON.stringify(['hello world', 'foo bar'].flatMap((s) => s.split(' ')))}`);
    // findLast / findLastIndex：从末尾查找
    L.push(`findLast(偶数)      = ${arr.findLast((x) => x % 2 === 0)}`);
    L.push(`findLastIndex(偶数) = ${arr.findLastIndex((x) => x % 2 === 0)}`);
    // 不可变版本：toSorted/toReversed/toSpliced/with（返回新数组，不改原数组）
    L.push(`toSorted        = ${JSON.stringify(arr.toSorted((a, b) => a - b))}`);
    L.push(`toReversed      = ${JSON.stringify(arr.toReversed())}`);
    L.push(`toSpliced(0,2)  = ${JSON.stringify(arr.toSpliced(0, 2))}`);
    L.push(`with(0,99)      = ${JSON.stringify(arr.with(0, 99))}`);
    L.push(`原数组保持不变   = ${JSON.stringify(arr)}`);
    // Object.groupBy / Map.groupBy（ES2024）
    const nums = [1, 2, 3, 4, 5, 6];
    if (typeof Object.groupBy === 'function') {
      L.push(`Object.groupBy(奇偶) = ${JSON.stringify(Object.groupBy(nums, (x) => (x % 2 ? 'odd' : 'even')))}`);
    } else {
      L.push('Object.groupBy 不可用（需 ES2024 环境）');
    }
    if (typeof Map.groupBy === 'function') {
      const mg = Map.groupBy(nums, (x) => (x % 2 ? 'odd' : 'even'));
      L.push(`Map.groupBy size = ${mg.size}，keys=[${[...mg.keys()].join(', ')}]`);
    } else {
      L.push('Map.groupBy 不可用（需 ES2024 环境）');
    }
    this.setState({ arrayMethodDemo: L.join('\n') });
    this._addLog('compress', `新数组方法演示完成（${L.length} 项）`);
  }

  // =================== 5. Object / String / Number 新方法 ===================
  _runObjectStringNumber() {
    const L = [];
    // Object.hasOwn：比 hasOwnProperty 更安全（对 Object.create(null) 仍可用）
    const protoless = Object.create(null);
    protoless.foo = 'bar';
    L.push(`Object.hasOwn(protoless, 'foo') = ${Object.hasOwn(protoless, 'foo')}`);
    L.push(`protoless.hasOwnProperty 可用？ ${typeof protoless.hasOwnProperty === 'function'}（故 hasOwn 更安全）`);
    // Object.fromEntries：entries 的反向操作
    L.push(`Object.fromEntries([['a',1],['b',2]]) = ${JSON.stringify(Object.fromEntries([['a', 1], ['b', 2]]))}`);
    // String.replaceAll：全局替换
    L.push(`'a-b-c'.replaceAll('-', '/') = ${'a-b-c'.replaceAll('-', '/')}`);
    // String.matchAll：全局正则匹配迭代器
    const matches = [...'2024-01-15 与 2025-12-31'.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)];
    L.push(`matchAll 命中 ${matches.length} 个日期：${matches.map((m) => m[0]).join(', ')}`);
    // String.at / padStart / padEnd
    L.push(`'hello'.at(-1) = ${'hello'.at(-1)}`);
    L.push(`'5'.padStart(3, '0') = ${'5'.padStart(3, '0')}`);
    L.push(`'5'.padEnd(3, '0')   = ${'5'.padEnd(3, '0')}`);
    // Number 方法
    L.push(`Number.isInteger(1.5) = ${Number.isInteger(1.5)}`);
    L.push(`Number.isFinite('100') = ${Number.isFinite('100')}  vs 全局 isFinite('100') = ${isFinite('100')}`);
    L.push(`Number.isNaN('NaN')    = ${Number.isNaN('NaN')}  vs 全局 isNaN('NaN') = ${isNaN('NaN')}`);
    L.push(`Number.isSafeInteger(2**53) = ${Number.isSafeInteger(2 ** 53)}`);
    L.push(`Number.MAX_SAFE_INTEGER = ${Number.MAX_SAFE_INTEGER}`);
    // 数值分隔符
    L.push(`数值分隔符 1_000_000 = ${1_000_000}`);
    this.setState({ objectStringDemo: L.join('\n') });
    this._addLog('bc', `Object/String/Number 新方法演示完成`);
  }

  // =================== 6. Map / Set / WeakMap / WeakSet ===================
  _runMapSet() {
    const L = [];
    // Map：键可以是任意类型（含对象），保持插入顺序
    const map = new Map();
    const objKey = {};
    map.set(objKey, '对象作键').set('str', '字符串键').set(1, '数字键');
    L.push(`Map.size = ${map.size}，键类型=[${[...map.keys()].map((k) => typeof k).join(', ')}]（保持插入顺序）`);
    L.push(`Map vs Object：Map 可用对象作键，Object 只能用字符串/Symbol 键`);
    // Set：去重 + 集合运算
    const setA = new Set([1, 2, 3, 4]);
    const setB = new Set([3, 4, 5, 6]);
    const union = new Set([...setA, ...setB]);
    const intersect = new Set([...setA].filter((x) => setB.has(x)));
    const difference = new Set([...setA].filter((x) => !setB.has(x)));
    L.push(`Set 去重 [1,1,2,2,3] = ${JSON.stringify([...new Set([1, 1, 2, 2, 3])])}`);
    L.push(`并集 A∪B = ${JSON.stringify([...union])}`);
    L.push(`交集 A∩B = ${JSON.stringify([...intersect])}`);
    L.push(`差集 A−B = ${JSON.stringify([...difference])}`);
    // WeakMap：键必须是对象，弱引用，不阻止 GC
    const wm = new WeakMap();
    const wkObj = { id: 1 };
    wm.set(wkObj, '关联数据');
    L.push(`WeakMap.get(wkObj) = ${wm.get(wkObj)}（键弱引用，不阻止 wkObj 被 GC）`);
    // WeakSet：值必须是对象，弱引用
    const ws = new WeakSet();
    ws.add(wkObj);
    L.push(`WeakSet.has(wkObj) = ${ws.has(wkObj)}`);
    L.push(`WeakMap/WeakSet 不可遍历、无 size 属性`);
    this.setState({ mapSetDemo: L.join('\n') });
    this._addLog('ws', `Map/Set/WeakMap/WeakSet 演示完成`);
  }

  // =================== 7. 逻辑赋值与空值合并 ===================
  _runLogic() {
    const L = [];
    // ?? 空值合并（仅 null/undefined）vs || 逻辑或（所有 falsy 触发）
    L.push(`0 ?? '默认'   = ${0 ?? '默认'}   // ?? 保留 0`);
    L.push(`0 || '默认'   = ${0 || '默认'}   // || 视 0 为 falsy`);
    L.push(`'' ?? '默认'  = ${'' ?? '默认'}  // ?? 保留空串`);
    L.push(`'' || '默认'  = ${'' || '默认'}`);
    L.push(`null ?? '默认' = ${null ?? '默认'}`);
    // ?. 可选链：安全访问深层属性/方法
    const user = { profile: { name: 'Alice' } };
    L.push(`user?.profile?.name = ${user?.profile?.name}`);
    L.push(`user?.settings?.theme = ${user?.settings?.theme ?? '未设置'}  // 安全访问深层属性`);
    L.push(`user?.greet?.() = ${user?.greet?.() ?? '方法不存在'}  // 安全调用方法`);
    // ??= / ||= / &&= 逻辑赋值
    let x = null; x ??= '赋值'; L.push(`let x=null; x??='赋值' → ${x}`);
    let y = '';   y ||= '赋值'; L.push(`let y='';   y||='赋值' → ${y}`);
    let z = 1;    z &&= 2;     L.push(`let z=1;    z&&=2     → ${z}`);
    this.setState({ logicDemo: L.join('\n') });
    this._addLog('mutate', `逻辑赋值与空值合并演示完成`);
  }

  // =================== 8. 顶层 await + 动态 import ===================
  async _runDynamicImport() {
    try {
      // 动态 import()：运行时按需加载模块，返回 Promise<Module>
      // 由于本页是 Page 类（非顶层模块），用 async 函数包裹 await 演示
      const mod = await import('../../core/utils.js');
      const hasFormatTime = typeof mod.formatTime === 'function';
      const hasH = typeof mod.h === 'function';
      // import.meta：模块自身元信息（仅 ES Module 可用）
      let metaInfo = '不可用';
      try { metaInfo = (typeof import.meta !== 'undefined') ? '可用' : '不可用'; } catch { /* noop */ }
      this.setState({
        dynamicImportResult: `动态 import('../../core/utils.js') 成功\n` +
          `导出 formatTime：${hasFormatTime ? '✓' : '✗'}\n` +
          `导出 h：${hasH ? '✓' : '✗'}\n` +
          `import.meta：${metaInfo}\n` +
          `说明：顶层 await 仅在 ES Module 顶层可用；本页用 async 函数包裹 await 演示动态 import\n` +
          `注意：动态 import 在 file:// 协议下不工作，需要 HTTP 服务器`,
      });
      this._addLog('info', `动态 import 成功：formatTime=${hasFormatTime}, h=${hasH}, import.meta=${metaInfo}`);
    } catch (err) {
      this.setState({ dynamicImportResult: `动态 import 失败：${err.message}\n（注意：file:// 协议下不工作，需 HTTP 服务器）` });
      this._addLog('error', `动态 import 失败：${err.message}`);
    }
  }

  // =================== 渲染 ===================
  renderPage() {
    // generatorResults 为数组：[{ name, values }]
    const genText = this.state.generatorResults.length
      ? this.state.generatorResults.map((g) => `${g.name} = [${g.values.join(', ')}]`).join('\n')
      : '（点击「运行 Generator」）';

    return [
      h('h2', { class: 'section-title' }, '现代 ES2020-2024 特性实验室'),

      h(Alert, {
        type: 'info',
        message: 'WeakRef / Iterator / Promise 组合器 / 新数组方法 / Object-String-Number / Map-Set / 逻辑赋值 / 动态 import',
        description: '八大现代 JavaScript 特性综合演示。所有操作日志输出在页面底部日志面板，便于追踪事件流转。',
      }),

      // ============ 1. WeakRef + FinalizationRegistry ============
      h(Card, {
        title: '1. WeakRef + FinalizationRegistry（弱引用与垃圾回收监听）',
        extra: h(Tag, { color: this.state.gcTriggered ? 'error' : 'default' }, this.state.gcTriggered ? '已触发 GC 回调' : '未触发'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'WeakRef 包装对象而不阻止其被 GC；FinalizationRegistry 注册回调，在对象被回收时触发。WeakRef 用于缓存，FinalizationRegistry 用于资源清理。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('创建 WeakRef', { type: 'primary', size: 'sm', onClick: () => this._createWeakRef() }),
            this._btn('检查 deref()', { size: 'sm', onClick: () => this._checkWeakRef() }),
            this._btn('解除强引用', { danger: true, size: 'sm', onClick: () => this._tryGc() }),
          ),
          h('pre', { class: 'code-block' }, this.state.weakRefResult),
          h('p', { class: 'fs-sm text-tertiary' },
            '提示：GC 不可手动触发，点击「解除强引用」后，切换标签页或等待一段时间，再点「检查 deref()」观察是否变为 undefined。'),
        ),
      ),

      // ============ 2. Iterator / Generator / async iteration ============
      h(Card, {
        title: '2. Iterator / Generator / async iteration（迭代器与生成器）',
        extra: h(Tag, { color: 'primary' }, 'Symbol.iterator'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '自定义 Iterator 实现 Symbol.iterator 协议；Generator 用 function* + yield；yield* 委托其他可迭代对象；async iterator 用 Symbol.asyncIterator + for await...of。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('运行 Iterator', { type: 'primary', size: 'sm', onClick: () => this._runIterators() }),
            this._btn('运行 Generator', { type: 'primary', size: 'sm', onClick: () => this._runGenerators() }),
            this._btn('运行 async iter', { type: 'primary', size: 'sm', onClick: () => this._runAsyncIter() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, '自定义 Iterator（for...of 遍历结果）：'),
          h('pre', { class: 'code-block' }, this.state.iterResults.length ? `[${this.state.iterResults.join(', ')}]` : '（点击「运行 Iterator」）'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Generator（fib / range / yield* 委托）：'),
          h('pre', { class: 'code-block' }, genText),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'async iterator（for await...of）：'),
          h('pre', { class: 'code-block' }, this.state.asyncIterResults.length ? `[${this.state.asyncIterResults.join(', ')}]` : '（点击「运行 async iter」）'),
        ),
      ),

      // ============ 3. Promise 组合器 ============
      h(Card, {
        title: '3. Promise 组合器（all / race / allSettled / any + AggregateError）',
        extra: h(Tag, { color: 'warning' }, '4 个随机延迟 Promise'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '生成 4 个 100-1000ms 随机延迟的 Promise（P1/P3 resolve，P2/P4 reject）。all 全成功才成功；race 第一个完成；allSettled 全部完成；any 第一个成功，全失败抛 AggregateError。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('Promise.all', { type: 'primary', size: 'sm', onClick: () => this._runPromiseAll() }),
            this._btn('Promise.race', { type: 'primary', size: 'sm', onClick: () => this._runPromiseRace() }),
            this._btn('Promise.allSettled', { type: 'primary', size: 'sm', onClick: () => this._runPromiseAllSettled() }),
            this._btn('Promise.any', { type: 'primary', size: 'sm', onClick: () => this._runPromiseAny() }),
            this._btn('any(全失败→AggregateError)', { danger: true, size: 'sm', onClick: () => this._runPromiseAnyAllReject() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, 'Promise.all 结果：'),
          h('pre', { class: 'code-block' }, this.state.promiseAllResult || '（点击「Promise.all」）'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Promise.race 结果：'),
          h('pre', { class: 'code-block' }, this.state.promiseRaceResult || '（点击「Promise.race」）'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Promise.allSettled 结果：'),
          h('pre', { class: 'code-block' }, this.state.promiseAllSettledResult || '（点击「Promise.allSettled」）'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Promise.any 结果（含 AggregateError 演示）：'),
          h('pre', { class: 'code-block' }, this.state.promiseAnyResult || '（点击「Promise.any」）'),
        ),
      ),

      // ============ 4. 新数组方法 ============
      h(Card, {
        title: '4. 新数组方法（at / flat / flatMap / findLast / toSorted / with / groupBy）',
        extra: h(Tag, { color: 'primary' }, 'ES2022-2024'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'at() 负索引取值；flat/flatMap 扁平化；findLast/findLastIndex 从末尾查找；toSorted/toReversed/toSpliced/with 为不可变版本；Object.groupBy/Map.groupBy 分组（ES2024）。'),
          this._btn('运行数组方法演示', { type: 'primary', size: 'sm', onClick: () => this._runArrayMethods() }),
          h('pre', { class: 'code-block' }, this.state.arrayMethodDemo || '（点击「运行数组方法演示」）'),
        ),
      ),

      // ============ 5. Object / String / Number 新方法 ============
      h(Card, {
        title: '5. Object / String / Number 新方法',
        extra: h(Tag, { color: 'success' }, 'hasOwn / replaceAll / matchAll'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Object.hasOwn/fromEntries；String.replaceAll/matchAll/at/padStart/padEnd；Number.isInteger/isFinite/isNaN/isSafeInteger/MAX_SAFE_INTEGER；数值分隔符 1_000_000。'),
          this._btn('运行 Object/String/Number 演示', { type: 'primary', size: 'sm', onClick: () => this._runObjectStringNumber() }),
          h('pre', { class: 'code-block' }, this.state.objectStringDemo || '（点击按钮演示）'),
        ),
      ),

      // ============ 6. Map / Set / WeakMap / WeakSet ============
      h(Card, {
        title: '6. Map / Set / WeakMap / WeakSet',
        extra: h(Tag, { color: 'warning' }, '集合类型'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Map 键值对（键可任意类型，保持顺序）；Set 唯一值集合；WeakMap/WeakSet 键/值为对象且弱引用，不阻止 GC，不可遍历。'),
          this._btn('运行 Map/Set 演示', { type: 'primary', size: 'sm', onClick: () => this._runMapSet() }),
          h('pre', { class: 'code-block' }, this.state.mapSetDemo || '（点击按钮演示）'),
        ),
      ),

      // ============ 7. 逻辑赋值与空值合并 ============
      h(Card, {
        title: '7. 逻辑赋值与空值合并（?? / ?. / ??= / ||= / &&=）',
        extra: h(Tag, { color: 'primary' }, 'ES2020-2021'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '?? 仅对 null/undefined 触发（vs || 对所有 falsy 触发）；?. 可选链安全访问深层属性/方法；??= / ||= / &&= 逻辑赋值运算符。'),
          this._btn('运行逻辑赋值演示', { type: 'primary', size: 'sm', onClick: () => this._runLogic() }),
          h('pre', { class: 'code-block' }, this.state.logicDemo || '（点击按钮演示）'),
        ),
      ),

      // ============ 8. 顶层 await + 动态 import ============
      h(Card, {
        title: '8. 顶层 await + 动态 import()',
        extra: h(Tag, { color: 'success' }, 'ES2020 / import.meta'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '顶层 await 在 ES Module 顶层直接用 await；动态 import() 运行时按需加载模块；import.meta 暴露模块元信息。本页用 async 函数包裹演示动态 import 一个已有模块。'),
          this._btn('运行动态 import', { type: 'primary', size: 'sm', onClick: () => this._runDynamicImport() }),
          h('pre', { class: 'code-block' }, this.state.dynamicImportResult || '（点击按钮演示）'),
        ),
      ),

      // ============ 日志面板 ============
      h(Card, {
        title: '事件日志',
        extra: h(Tag, { color: 'primary' }, `${this.state.logs.length} 条`),
      },
        this.state.logs.length === 0
          ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无日志）')
          : h('div', { class: 'log-panel' },
            ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
              h('span', {}, log.content),
            )),
          ),
      ),
    ];
  }
}
