// =====================================================================
// ModernES2024Page.js —— ES2023 / ES2024+ 新特性实验室
// 演示：
//   1. Set 新方法（ES2024）：union / intersection / difference /
//      symmetricDifference / isSubsetOf / isSupersetOf / isDisjointFrom
//   2. Iterator Helpers（ES2024 提案）：map / filter / take / drop /
//      flatMap / reduce / forEach / toArray / Iterator.from —— 惰性链式
//   3. Array.fromAsync（ES2024）+ Object.groupBy / Map.groupBy（ES2024）
//   4. String.isWellFormed / toWellFormed（ES2024）+ Promise.withResolvers
//   5. Resizable ArrayBuffer + Growable SharedArrayBuffer（ES2024）：
//      maxByteLength / resizable / grow / transfer / transferToFixedLength / detached
//   6. Proxy + Reflect 深度元编程 + Well-known Symbols：
//      Symbol.species / toPrimitive / toStringTag / hasInstance / isConcatSpreadable
// 说明：ES2024 新特性需 Node 22+ / 较新浏览器。所有 API 调用前做 typeof
//       能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class ModernES2024Page extends Page {
    _inited;
    _proxy;
    _resizableBuffer;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            setOpsResult: '', // Card 1：Set 新方法
            iteratorResult: '', // Card 2：Iterator helpers
            groupByResult: '', // Card 3：Array.fromAsync + groupBy
            stringPromiseResult: '', // Card 4：String + Promise.withResolvers
            bufferResult: '', // Card 5：Resizable ArrayBuffer
            proxyResult: '', // Card 6：Proxy + Reflect + Symbol
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._resizableBuffer = null; // Card 5 可调整大小的 ArrayBuffer
        this._proxy = null; // Card 6 Proxy 实例
        const caps = this._caps();
        const parts = [
            `Set 新方法 ${caps.setMethods ? '✓' : '✗'}`,
            `Iterator helpers ${caps.iterator ? '✓' : '✗'}`,
            `Array.fromAsync ${caps.fromAsync ? '✓' : '✗'}`,
            `Object.groupBy ${caps.objectGroupBy ? '✓' : '✗'}`,
            `Map.groupBy ${caps.mapGroupBy ? '✓' : '✗'}`,
            `String.isWellFormed ${caps.stringWellFormed ? '✓' : '✗'}`,
            `Promise.withResolvers ${caps.withResolvers ? '✓' : '✗'}`,
            `Resizable ArrayBuffer ${caps.resizableBuffer ? '✓' : '✗'}`,
            `ArrayBuffer.transfer ${caps.transferBuffer ? '✓' : '✗'}`,
            `Proxy/Reflect ${caps.proxy && caps.reflect ? '✓' : '✗'}`,
        ];
        const allModern = caps.setMethods && caps.iterator && caps.fromAsync &&
            caps.objectGroupBy && caps.mapGroupBy && caps.stringWellFormed &&
            caps.withResolvers && caps.resizableBuffer;
        const summary = allModern
            ? `ES2024 能力检测：${parts.join(' · ')}。当前环境支持全部 ES2024 新特性，所有按钮可真实演示。`
            : `ES2024 能力检测：${parts.join(' · ')}。部分特性需 Node 22+ / 较新浏览器；不可用的按钮点击将仅记日志说明，不会抛异常。`;
        this.setState({ capsSummary: summary });
        this._addLog(allModern ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!caps.setMethods)
            this._addLog('warn', 'Set 新方法（union 等）不可用，需 Node 22+');
        if (!caps.iterator)
            this._addLog('warn', 'Iterator helpers 不可用（Iterator 全局对象或 .map 不存在），需 Node 22+');
        if (!caps.fromAsync)
            this._addLog('warn', 'Array.fromAsync 不可用，需 Node 22+');
        if (!caps.objectGroupBy || !caps.mapGroupBy)
            this._addLog('warn', 'Object.groupBy / Map.groupBy 不可用，需 Node 22+');
        if (!caps.stringWellFormed)
            this._addLog('warn', 'String.prototype.isWellFormed / toWellFormed 不可用，需 Node 20+');
        if (!caps.withResolvers)
            this._addLog('warn', 'Promise.withResolvers 不可用，需 Node 22+');
        if (!caps.resizableBuffer)
            this._addLog('warn', 'Resizable ArrayBuffer 不可用，需 Node 22+');
    }
    componentWillUnmount() {
        // 释放实例引用，便于 GC
        this._resizableBuffer = null;
        this._proxy = null;
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
        const setMethods = typeof Set !== 'undefined' && typeof Set.prototype.union === 'function';
        const iterator = typeof Iterator !== 'undefined' && typeof Iterator.prototype.map === 'function';
        const fromAsync = typeof Array.fromAsync === 'function';
        const objectGroupBy = typeof Object !== 'undefined' && typeof Object.groupBy === 'function';
        const mapGroupBy = typeof Map !== 'undefined' && typeof Map.groupBy === 'function';
        const stringWellFormed = typeof String.prototype.isWellFormed === 'function';
        const withResolvers = typeof Promise !== 'undefined' && typeof Promise.withResolvers === 'function';
        let resizableBuffer = false;
        try {
            resizableBuffer = 'resizable' in ArrayBuffer.prototype;
        }
        catch { /* 老引擎无此属性 */ }
        const transferBuffer = typeof ArrayBuffer.prototype.transfer === 'function';
        const proxy = typeof Proxy !== 'undefined';
        const reflect = typeof Reflect !== 'undefined';
        const symbol = typeof Symbol !== 'undefined';
        return {
            setMethods, iterator, fromAsync, objectGroupBy, mapGroupBy,
            stringWellFormed, withResolvers, resizableBuffer, transferBuffer,
            proxy, reflect, symbol,
        };
    }
    // =================== Card 1：Set 新方法（ES2024）===================
    // Set A = {1,2,3,4}，Set B = {3,4,5,6}；union/intersection/difference/symmetricDifference 返回新 Set
    _setBasicOps() {
        if (!this._caps().setMethods) {
            this._addLog('warn', 'Set 新方法不可用（Set.prototype.union 不存在），需 Node 22+');
            return;
        }
        try {
            const A = new Set([1, 2, 3, 4]);
            const B = new Set([3, 4, 5, 6]);
            const fmt = (s) => `{${[...s].join(',')}}`;
            const union = A.union(B); // {1,2,3,4,5,6}
            const intersection = A.intersection(B); // {3,4}
            const difference = A.difference(B); // {1,2}（A 有 B 没有）
            const symDiff = A.symmetricDifference(B); // {1,2,5,6}（只在其中一个）
            this.setState({
                setOpsResult: `A = ${fmt(A)}，B = ${fmt(B)}\n\n` +
                    `A.union(B)                → ${fmt(union)}（并集）\n` +
                    `A.intersection(B)         → ${fmt(intersection)}（交集）\n` +
                    `A.difference(B)           → ${fmt(difference)}（差集：A 有 B 没有）\n` +
                    `A.symmetricDifference(B)  → ${fmt(symDiff)}（对称差集：只在一个集合中）\n\n` +
                    `说明：四个方法均返回新 Set，不修改原 Set；接受任意 Set 或可迭代对象作为参数。`,
            });
            this._addLog('set', `union=${fmt(union)}，intersection=${fmt(intersection)}，difference=${fmt(difference)}，symDiff=${fmt(symDiff)}`);
        }
        catch (err) {
            this._addLog('warn', `Set 基本运算失败：${err.name} - ${err.message}`);
        }
    }
    // isSubsetOf / isSupersetOf / isDisjointFrom 返回 boolean
    _setRelations() {
        if (!this._caps().setMethods) {
            this._addLog('warn', 'Set 新方法不可用（Set.prototype.isSubsetOf 不存在），需 Node 22+');
            return;
        }
        try {
            const A = new Set([1, 2, 3, 4]);
            const B = new Set([3, 4, 5, 6]);
            const C = new Set([3, 4]); // C ⊂ A
            const D = new Set([10, 20]); // D 与 A 不相交
            const isSub = C.isSubsetOf(A); // true（C 是 A 的子集）
            const isSuper = A.isSupersetOf(C); // true（A 是 C 的超集）
            const disjointD = A.isDisjointFrom(D); // true（A ∩ D = ∅）
            const disjointB = A.isDisjointFrom(B); // false（A ∩ B = {3,4}）
            this.setState({
                setOpsResult: `A = {1,2,3,4}，B = {3,4,5,6}，C = {3,4}，D = {10,20}\n\n` +
                    `C.isSubsetOf(A)      = ${isSub}（C ⊆ A）\n` +
                    `A.isSupersetOf(C)    = ${isSuper}（A ⊇ C）\n` +
                    `A.isDisjointFrom(D)  = ${disjointD}（A ∩ D = ∅ → 不相交）\n` +
                    `A.isDisjointFrom(B)  = ${disjointB}（A ∩ B = {3,4} ≠ ∅ → 相交）\n\n` +
                    `说明：三者返回 boolean，不创建新 Set；isDisjointFrom 等价于 intersection().size === 0 但更高效。`,
            });
            this._addLog('set', `isSubsetOf=${isSub}，isSupersetOf=${isSuper}，isDisjointFrom(D)=${disjointD}，isDisjointFrom(B)=${disjointB}`);
        }
        catch (err) {
            this._addLog('warn', `Set 关系运算失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '1. Set 新方法（ES2024）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.setMethods ? 'success' : 'error' }, caps.setMethods ? 'Set 新方法 ✓' : '不可用'), h(Tag, { color: 'primary' }, '7 个方法')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'ES2024 为 Set 新增 7 个方法：union / intersection / difference / symmetricDifference 返回新 Set（并集/交集/差集/对称差集）；isSubsetOf / isSupersetOf / isDisjointFrom 返回 boolean（子集/超集/不相交）。所有方法接受任意可迭代对象作为参数，不修改原 Set。检测方式：typeof Set.prototype.union === "function"。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('并集/交集/差集/对称差', { type: 'primary', size: 'sm', disabled: !caps.setMethods, onClick: () => this._setBasicOps() }), this._btn('子集/超集/不相交', { size: 'sm', disabled: !caps.setMethods, onClick: () => this._setRelations() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Set 运算结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.setOpsResult || '（点击按钮演示 Set 新方法）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } }, h('code', {}, `const A = new Set([1,2,3,4]), B = new Set([3,4,5,6]);
A.union(B);                // Set {1,2,3,4,5,6}
A.intersection(B);         // Set {3,4}
A.difference(B);           // Set {1,2}   A 有 B 没有
A.symmetricDifference(B);  // Set {1,2,5,6} 只在一个集合中
new Set([3,4]).isSubsetOf(A);       // true
A.isSupersetOf(new Set([3,4]));     // true
A.isDisjointFrom(new Set([10,20])); // true（无交集）`)),
                h(Alert, {
                    type: 'info',
                    message: 'Set 新方法让集合运算无需手写循环',
                    description: '此前做并集需 new Set([...A, ...B])，交集需 [...A].filter((x: any) => B.has(x))；ES2024 把这些标准化为原型方法，语义清晰且引擎可优化。参数可以是任意 Set 或可迭代对象（如数组）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：Iterator Helpers ===================
    // Iterator.from([...]).map().filter().take().toArray() —— 惰性链式求值
    _iteratorChain() {
        if (!this._caps().iterator) {
            this._addLog('warn', 'Iterator helpers 不可用（Iterator.prototype.map 不存在），需 Node 22+');
            return;
        }
        try {
            const it = Iterator.from([1, 2, 3, 4, 5]);
            const isIterator = it instanceof Iterator; // true（ES2024 Iterator 是全局构造器）
            // 链式：×2 → 保留 >4 → 取前 3 → 转数组
            const chain = it.map((x) => x * 2).filter((x) => x > 4).take(3);
            const chainIsIterator = chain instanceof Iterator;
            const arr = chain.toArray(); // [6,8,10]
            // 惰性求值验证：take(n) 取前 n 个后停止，不消费剩余元素
            let consumed = 0;
            const lazy = Iterator.from([1, 2, 3, 4, 5, 6, 7, 8])
                .map((x) => { consumed++; return x * 10; })
                .take(2)
                .toArray();
            this.setState({
                iteratorResult: `Iterator.from([1,2,3,4,5]) → Iterator 实例（instanceof Iterator = ${isIterator}）\n\n` +
                    `.map((x: any) => x*2).filter((x: any) => x>4).take(3).toArray()\n` +
                    `  中间 chain instanceof Iterator = ${chainIsIterator}（仍为 Iterator，惰性未求值）\n` +
                    `  最终 toArray() = ${JSON.stringify(arr)}（= [6,8,10]）\n\n` +
                    `惰性求值验证：[1..8].map(×10).take(2).toArray() = ${JSON.stringify(lazy)}\n` +
                    `  map 回调仅被调用 ${consumed} 次（take(2) 取够即停，剩余元素不计算）\n\n` +
                    `说明：map/filter/take/drop/flatMap 返回新 Iterator，toArray() 才真正求值。\n` +
                    `  Iterator 是 ES2024 新增的全局构造器（此前仅作为协议存在）。`,
            });
            this._addLog('iter', `链式 toArray()=${JSON.stringify(arr)}；惰性验证 take(2) 仅消费 ${consumed} 个`);
        }
        catch (err) {
            this._addLog('warn', `Iterator 链式调用失败：${err.name} - ${err.message}`);
        }
    }
    // drop / flatMap / reduce / forEach
    _iteratorMore() {
        if (!this._caps().iterator) {
            this._addLog('warn', 'Iterator helpers 不可用，需 Node 22+');
            return;
        }
        try {
            const dropped = Iterator.from([1, 2, 3, 4, 5]).drop(2).toArray(); // [3,4,5]
            const flat = Iterator.from([1, 2, 3]).flatMap((x) => [x, x * 10]).toArray(); // [1,10,2,20,3,30]
            const sum = Iterator.from([1, 2, 3, 4]).reduce((acc, x) => acc + x, 0); // 10
            const collected = [];
            Iterator.from(['a', 'b', 'c']).forEach((x) => collected.push(x.toUpperCase()));
            this.setState({
                iteratorResult: `drop(n)：跳过前 n 个\n` +
                    `  Iterator.from([1,2,3,4,5]).drop(2).toArray() = ${JSON.stringify(dropped)}\n\n` +
                    `flatMap(fn)：每元素映射为可迭代对象后展平\n` +
                    `  Iterator.from([1,2,3]).flatMap((x: any) => [x, x*10]).toArray() = ${JSON.stringify(flat)}\n\n` +
                    `reduce(fn, initial)：归约\n` +
                    `  Iterator.from([1,2,3,4]).reduce((a: any, x: any) => a+x, 0) = ${sum}\n\n` +
                    `forEach(fn)：遍历（无返回值，终结操作）\n` +
                    `  ['a','b','c'].forEach 收集 = ${JSON.stringify(collected)}\n\n` +
                    `说明：drop 与 take 互补；flatMap 展平一层；reduce/forEach 为消费端（终结操作）。`,
            });
            this._addLog('iter', `drop=${JSON.stringify(dropped)}，flatMap=${JSON.stringify(flat)}，reduce=${sum}，forEach=${JSON.stringify(collected)}`);
        }
        catch (err) {
            this._addLog('warn', `Iterator 扩展方法失败：${err.name} - ${err.message}`);
        }
    }
    // Iterator.from 接受任意可迭代对象（含自定义 [Symbol.iterator] 与生成器）
    _iteratorFrom() {
        if (!this._caps().iterator) {
            this._addLog('warn', 'Iterator helpers 不可用，需 Node 22+');
            return;
        }
        try {
            const range = {
                from: 1, to: 5,
                [Symbol.iterator]() {
                    let i = this.from;
                    const end = this.to;
                    return { next() { return i <= end ? { value: i++, done: false } : { value: undefined, done: true }; } };
                },
            };
            const it = Iterator.from(range); // 将可迭代对象转为 Iterator
            const isInst = it instanceof Iterator;
            const squared = it.map((x) => x * x).toArray(); // [1,4,9,16,25]
            const gen = function* () { yield 'x'; yield 'y'; yield 'z'; };
            const fromGen = Iterator.from(gen()).filter((s) => s !== 'y').toArray(); // ['x','z']
            this.setState({
                iteratorResult: `自定义可迭代对象 range = { from:1, to:5, [Symbol.iterator]() {...} }\n` +
                    `Iterator.from(range) → Iterator 实例（instanceof Iterator = ${isInst}）\n` +
                    `  .map((x: any) => x*x).toArray() = ${JSON.stringify(squared)}\n\n` +
                    `包装生成器：Iterator.from(gen()).filter((s: any) => s!=='y').toArray() = ${JSON.stringify(fromGen)}\n\n` +
                    `说明：Iterator.from(iterable) 将任意可迭代对象（含生成器、NodeList 等）统一为 Iterator，\n` +
                    `  之后即可链式调用 map/filter/take/drop 等 helper。Iterator 是 ES2024 新增的全局构造器。`,
            });
            this._addLog('iter', `Iterator.from(range).map(²).toArray()=${JSON.stringify(squared)}；从生成器=${JSON.stringify(fromGen)}`);
        }
        catch (err) {
            this._addLog('warn', `Iterator.from 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '2. Iterator Helpers（ES2024 提案）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.iterator ? 'success' : 'error' }, caps.iterator ? 'Iterator ✓' : '不可用'), h(Tag, { color: 'primary' }, '惰性求值')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Iterator.prototype 新增 map / filter / take / drop / flatMap / reduce / forEach / toArray 等方法，返回 Iterator 实例（非数组），惰性求值——只有调用 toArray() / reduce() / forEach() 等终结操作才真正计算。Iterator.from(iterable) 把任意可迭代对象（含生成器）转为 Iterator。检测方式：typeof Iterator !== "undefined" && typeof Iterator.prototype.map === "function"。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('链式 map/filter/take', { type: 'primary', size: 'sm', disabled: !caps.iterator, onClick: () => this._iteratorChain() }), this._btn('drop/flatMap/reduce', { size: 'sm', disabled: !caps.iterator, onClick: () => this._iteratorMore() }), this._btn('Iterator.from', { size: 'sm', disabled: !caps.iterator, onClick: () => this._iteratorFrom() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Iterator 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.iteratorResult || '（点击按钮演示 Iterator helpers）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `// 惰性链式：每步返回 Iterator，toArray() 才求值
const r = Iterator.from([1,2,3,4,5])
  .map((x: any) => x * 2).filter((x: any) => x > 4).take(3).toArray(); // [6,8,10]
Iterator.from([1,2,3]).flatMap((x: any) => [x, x*10]).toArray(); // [1,10,2,20,3,30]`)),
                h(Alert, {
                    type: 'info',
                    message: 'Iterator helpers 是惰性的，take(n) 取够即停',
                    description: '与数组方法不同，Iterator.map/filter 返回的是 Iterator 而非数组，中间步骤不分配数组、不计算全部元素；take(n) 在取够 n 个后立即停止消费上游，对无限迭代器尤为关键（如 Iterator.from(naturalNumbers()).take(5)）。需 Node 22+ 或较新浏览器。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：Array.fromAsync + groupBy ===================
    // Array.fromAsync(asyncIterable) → Promise<Array>：消费异步迭代器
    async _fromAsync() {
        if (!this._caps().fromAsync) {
            this._addLog('warn', 'Array.fromAsync 不可用，需 Node 22+');
            return;
        }
        try {
            this._addLog('async', '开始 Array.fromAsync(asyncGenerator)…');
            const asyncGen = async function* () {
                for (let i = 1; i <= 5; i++) {
                    await Promise.resolve();
                    yield i * i;
                } // 1,4,9,16,25
            };
            const arr = await Array.fromAsync(asyncGen());
            const arr2 = await Array.fromAsync(asyncGen(), (x) => `=${x}`); // mapFn(item, index)
            const fromSync = await Array.fromAsync([10, 20, 30]); // 普通数组也接受
            this.setState({
                groupByResult: `Array.fromAsync(asyncGenerator) → Promise<Array>\n` +
                    `  异步生成器 yield 1,4,9,16,25 → ${JSON.stringify(arr)}\n\n` +
                    `Array.fromAsync(asyncGen, mapFn) → Promise<Array>（带映射）\n` +
                    `  mapFn = (x: any) => '='+x → ${JSON.stringify(arr2)}\n\n` +
                    `Array.fromAsync([10,20,30])（普通数组也接受）→ ${JSON.stringify(fromSync)}\n\n` +
                    `说明：fromAsync 接受 AsyncIterable / Iterable / ArrayLike；mapFn(item, index) 可选。\n` +
                    `  相比 for await...of 手动收集，fromAsync 一行完成异步迭代器 → 数组的转换。`,
            });
            this._addLog('async', `fromAsync 完成：${JSON.stringify(arr)}，带 mapFn=${JSON.stringify(arr2)}`);
        }
        catch (err) {
            this._addLog('warn', `Array.fromAsync 失败：${err.name} - ${err.message}`);
        }
    }
    // Object.groupBy(items, cb) → Object（无原型，键为 string/Symbol）
    _objectGroupBy() {
        if (!this._caps().objectGroupBy) {
            this._addLog('warn', 'Object.groupBy 不可用，需 Node 22+');
            return;
        }
        try {
            const items = [
                { name: '苹果', cat: '水果' }, { name: '胡萝卜', cat: '蔬菜' },
                { name: '香蕉', cat: '水果' }, { name: '菠菜', cat: '蔬菜' }, { name: '牛奶', cat: '饮品' },
            ];
            const grouped = Object.groupBy(items, (item) => item.cat);
            const hasProto = Object.getPrototypeOf(grouped) === Object.prototype; // false（无原型）
            const keys = Object.keys(grouped); // ['水果','蔬菜','饮品']
            this.setState({
                groupByResult: `Object.groupBy(items, item => item.cat)\n` +
                    `  items 名称 = ${JSON.stringify(items.map((i) => i.name))}\n\n` +
                    `分组结果（JSON）：${JSON.stringify(grouped)}\n\n` +
                    `(Object as any).keys(grouped) = ${JSON.stringify(keys)}\n` +
                    `  grouped['水果'] = ${JSON.stringify(grouped['水果'].map((i) => i.name))}\n` +
                    `  grouped['蔬菜'] = ${JSON.stringify(grouped['蔬菜'].map((i) => i.name))}\n` +
                    `  grouped['饮品'] = ${JSON.stringify(grouped['饮品'].map((i) => i.name))}\n` +
                    `getPrototypeOf === Object.prototype = ${hasProto}（返回无原型对象，防原型污染）\n\n` +
                    `说明：Object.groupBy 的键只能是 string/Symbol；若分组键是对象会被强转为字符串。`,
            });
            this._addLog('group', `Object.groupBy：keys=${JSON.stringify(keys)}，无原型=${!hasProto}`);
        }
        catch (err) {
            this._addLog('warn', `Object.groupBy 失败：${err.name} - ${err.message}`);
        }
    }
    // Map.groupBy(items, cb) → Map（键可为任意值，含对象）
    _mapGroupBy() {
        if (!this._caps().mapGroupBy) {
            this._addLog('warn', 'Map.groupBy 不可用，需 Node 22+');
            return;
        }
        try {
            const items = [
                { name: '苹果', type: { id: 'fruit' } }, { name: '胡萝卜', type: { id: 'veg' } },
                { name: '香蕉', type: { id: 'fruit' } }, { name: '菠菜', type: { id: 'veg' } },
            ];
            const grouped = Map.groupBy(items, (item) => item.type);
            const size = grouped.size; // 2（两个不同的 type 对象）
            const result = [];
            for (const [key, group] of grouped) {
                result.push(`键 {id:'${key.id}'} → [${group.map((i) => i.name).join(', ')}]`);
            }
            // 演示：对象作为键，引用相等 → 同一组
            const keyObj = { k: 'a' };
            const m = Map.groupBy([{ v: 1 }, { v: 2 }], (_item, i) => (i === 0 ? keyObj : keyObj));
            const sameKey = m.size === 1; // true（同一对象引用 → 同一组）
            this.setState({
                groupByResult: `Map.groupBy(items, item => item.type)\n` +
                    `  items 的 type 为不同对象 {id:'fruit'} / {id:'veg'}\n\n` +
                    `分组结果（Map，size=${size}）：\n  ${result.join('\n  ')}\n\n` +
                    `对象键验证：用同一对象引用 {k:'a'} 作为两组的键\n` +
                    `  Map.size = ${m.size}（同一引用归为一组）→ sameKey=${sameKey}\n\n` +
                    `Object.groupBy vs Map.groupBy：\n` +
                    `  Object.groupBy → 无原型对象，键仅 string/Symbol\n` +
                    `  Map.groupBy → Map，键可为任意值（含对象），按引用/同值相等`,
            });
            this._addLog('group', `Map.groupBy：size=${size}（对象作键）；同引用归一组=${sameKey}`);
        }
        catch (err) {
            this._addLog('warn', `Map.groupBy 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '3. Array.fromAsync + Object/Map.groupBy（ES2024）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.fromAsync ? 'success' : 'error' }, caps.fromAsync ? 'fromAsync ✓' : '不可用'), h(Tag, { color: caps.objectGroupBy && caps.mapGroupBy ? 'success' : 'error' }, caps.objectGroupBy && caps.mapGroupBy ? 'groupBy ✓' : 'groupBy ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Array.fromAsync(asyncIterable, mapFn?) → Promise<Array>：把异步迭代器（或同步可迭代/ArrayLike）转成数组，mapFn(item, index) 可选。Object.groupBy(items, cb) → 无原型对象（键为 string/Symbol，防原型污染）；Map.groupBy(items, cb) → Map（键可为任意值，含对象）。cb(item, index) 返回分组键。检测：typeof Array.fromAsync === "function" / typeof Object.groupBy === "function"。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('Array.fromAsync', { type: 'primary', size: 'sm', disabled: !caps.fromAsync, onClick: () => this._fromAsync() }), this._btn('Object.groupBy', { size: 'sm', disabled: !caps.objectGroupBy, onClick: () => this._objectGroupBy() }), this._btn('Map.groupBy', { size: 'sm', disabled: !caps.mapGroupBy, onClick: () => this._mapGroupBy() })),
                h('div', { class: 'fs-sm text-secondary' }, 'fromAsync / groupBy 结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } }, h('code', {}, s.groupByResult || '（点击按钮演示 fromAsync / groupBy）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `const arr = await Array.fromAsync(asyncGen());          // 异步迭代器 → 数组
const byCat = Object.groupBy(items, x => x.cat);        // 无原型对象（键 string/Symbol）
const byType = Map.groupBy(items, x => x.type);         // Map（键可为对象）`)),
                h(Alert, {
                    type: 'warning',
                    message: 'Object.groupBy vs Map.groupBy 的关键区别',
                    description: 'Object.groupBy 的键只能是 string/Symbol，分组键是对象会被 toString（"[object Object]"）导致所有对象键合并；若需用对象作键，应使用 Map.groupBy（键按引用/SameValueZero 相等）。Object.groupBy 返回无原型对象（getPrototypeOf 为 null），防止原型污染攻击。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：String + Promise.withResolvers ===================
    // String.isWellFormed() / toWellFormed()：处理含孤立代理项（lone surrogate）的字符串
    _stringWellFormed() {
        if (!this._caps().stringWellFormed) {
            this._addLog('warn', 'String.prototype.isWellFormed / toWellFormed 不可用，需 Node 20+');
            return;
        }
        try {
            const ok = 'hello\uD83D\uDE00'; // 成对代理项，合法 UTF-16（解码为笑脸字符）
            const lone = 'abc\uD800def'; // 含孤立高代理项（非法 UTF-16）
            const okWell = ok.isWellFormed(); // true
            const loneWell = lone.isWellFormed(); // false
            const fixed = lone.toWellFormed(); // 'abc\uFFFDdef'（替换为 U+FFFD）
            this.setState({
                stringPromiseResult: `String.prototype.isWellFormed() → boolean（是否为合法 UTF-16，无孤立代理项）\n` +
                    `String.prototype.toWellFormed() → string（将孤立代理项替换为 U+FFFD）\n\n` +
                    `正常字符串 'hello\\uD83D\\uDE00'（成对代理项，解码为笑脸字符）：isWellFormed() = ${okWell}\n\n` +
                    `含孤立代理项 'abc\\uD800def'（\\uD800 为孤立高代理项）：\n` +
                    `  isWellFormed() = ${loneWell}（false：检测到孤立代理项）\n` +
                    `  toWellFormed() = ${JSON.stringify(fixed)}（\\uD800 → \\uFFFD 替换字符）\n` +
                    `  原长度 ${lone.length} → 修复后长度 ${fixed.length}（长度不变，1 替 1）\n\n` +
                    `说明：lone surrogate 会导致 fetch / TextEncoder / URL 等抛错或乱码；\n` +
                    `  toWellFormed 提供安全的损失性修复（U+FFFD 即"替换字符 REPLACEMENT CHARACTER"）。`,
            });
            this._addLog('str', `isWellFormed：正常=${okWell}，lone=${loneWell}；toWellFormed 长度 ${lone.length}→${fixed.length}`);
        }
        catch (err) {
            this._addLog('warn', `String 方法失败：${err.name} - ${err.message}`);
        }
    }
    // Promise.withResolvers() → { promise, resolve, reject }：resolve/reject 暴露在外
    async _withResolvers() {
        if (!this._caps().withResolvers) {
            this._addLog('warn', 'Promise.withResolvers 不可用，需 Node 22+');
            return;
        }
        try {
            this._addLog('async', '开始 Promise.withResolvers() 演示…');
            // 等价于手动 new Promise((resolve: any, reject: any) => { ... 把 resolve/reject 存到外部 })
            const { promise, resolve, reject } = Promise.withResolvers();
            let settled = 'pending';
            promise.then((v) => { settled = `fulfilled: ${v}`; }, (e) => { settled = `rejected: ${e}`; });
            const beforeState = settled;
            setTimeout(() => resolve(42), 0); // resolve 在 promise 外部可访问
            const value = await promise; // 42
            await Promise.resolve();
            await Promise.resolve(); // 等微任务让 then 回调执行
            // 演示 reject 也可在外部调用
            const { promise: p2, reject: rej2 } = Promise.withResolvers();
            let rejResult = 'pending';
            p2.catch((e) => { rejResult = `rejected: ${e}`; });
            rej2(new Error('外部 reject'));
            await p2.catch(() => { });
            await Promise.resolve();
            await Promise.resolve();
            this.setState({
                stringPromiseResult: `Promise.withResolvers() → { promise, resolve, reject }\n\n` +
                    `const { promise, resolve, reject } = Promise.withResolvers();\n` +
                    `  调用前 settled = ${beforeState}\n` +
                    `  setTimeout(() => resolve(42), 0)\n` +
                    `  await promise = ${value}，resolve 后 settled = ${settled}\n\n` +
                    `reject 同样可在外部调用：\n` +
                    `  const { promise:p2, reject:rej2 } = Promise.withResolvers();\n` +
                    `  rej2(new Error('外部 reject')) → p2 结果 = ${rejResult}\n\n` +
                    `传统写法对比：let r; new Promise((res: any) => { r = res; }); r(42);\n` +
                    `  （需在外层作用域先声明变量，再在 executor 回调里赋值，样板代码多）\n\n` +
                    `说明：withResolvers 把 resolve/reject 直接解构出来，省去外层声明变量\n` +
                    `  再在 executor 回调里赋值的样板；适合事件回调、流处理、跨函数协作等\n` +
                    `  需要在 promise 外部触发结算的场景。`,
            });
            this._addLog('async', `withResolvers：await promise = ${value}，settled = ${settled}；reject 演示 = ${rejResult}`);
        }
        catch (err) {
            this._addLog('warn', `Promise.withResolvers 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '4. String.isWellFormed/toWellFormed + Promise.withResolvers',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.stringWellFormed ? 'success' : 'error' }, caps.stringWellFormed ? 'String ✓' : 'String ✗'), h(Tag, { color: caps.withResolvers ? 'success' : 'error' }, caps.withResolvers ? 'withResolvers ✓' : 'withResolvers ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'String.prototype.isWellFormed() → boolean：判断字符串是否为合法 UTF-16（无孤立代理项 lone surrogate）；toWellFormed() → string：把孤立代理项替换为 U+FFFD（不改变长度）。Promise.withResolvers() → { promise, resolve, reject }：等价于 new Promise + 把 resolve/reject 解构到外部，省去手动捕获样板。检测：typeof String.prototype.isWellFormed === "function" / typeof Promise.withResolvers === "function"。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('isWellFormed/toWellFormed', { type: 'primary', size: 'sm', disabled: !caps.stringWellFormed, onClick: () => this._stringWellFormed() }), this._btn('Promise.withResolvers', { type: 'primary', size: 'sm', disabled: !caps.withResolvers, onClick: () => this._withResolvers() })),
                h('div', { class: 'fs-sm text-secondary' }, 'String / Promise 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } }, h('code', {}, s.stringPromiseResult || '（点击按钮演示 String 新方法 / Promise.withResolvers）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `'abc\\uD800def'.isWellFormed();  // false
'abc\\uD800def'.toWellFormed();  // 'abc\\uFFFDdef'（U+FFFD 替换）
const { promise, resolve, reject } = Promise.withResolvers();
btn.onclick = () => resolve(42);   // 在事件回调里触发结算
const v = await promise;            // 42`)),
                h(Alert, {
                    type: 'info',
                    message: 'withResolvers 让 resolve/reject 不再受困于 executor 闭包',
                    description: '传统 new Promise((resolve: any) => { ... }) 中 resolve 只在 executor 作用域可见，外部触发结算需先声明变量再赋值；withResolvers 直接返回 { promise, resolve, reject }，特别适合流处理、事件回调、ReadableStream 等需要在 promise 外部触发结算的场景。String 两个方法则让 UTF-16 合法性检测与修复标准化。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：Resizable ArrayBuffer ===================
    // new ArrayBuffer(length, { maxByteLength }) —— 可调整大小
    _createResizableBuffer() {
        if (!this._caps().resizableBuffer) {
            this._addLog('warn', 'Resizable ArrayBuffer 不可用，需 Node 22+');
            return;
        }
        try {
            const ab = new ArrayBuffer(8, { maxByteLength: 32 });
            this._resizableBuffer = ab;
            this.setState({
                bufferResult: `new ArrayBuffer(8, { maxByteLength: 32 })\n` +
                    `  (ab as any).byteLength = ${ab.byteLength}（初始 8）\n` +
                    `  ab.maxByteLength = ${ab.maxByteLength}（最大 32）\n` +
                    `  ab.resizable = ${ab.resizable}（true：可调整大小）\n\n` +
                    `说明：maxByteLength 必须 >= length；resizable 为 true 时可 grow 到 maxByteLength。\n` +
                    `  SharedArrayBuffer 同理用 { maxByteLength } 创建可增长（growable）共享缓冲区\n` +
                    `  （sab.growable / sab.maxByteLength / sab.grow(n)）。`,
            });
            this._addLog('buf', `创建可调整 ArrayBuffer：byteLength=${ab.byteLength}，max=${ab.maxByteLength}，resizable=${ab.resizable}`);
        }
        catch (err) {
            this._addLog('warn', `创建 Resizable ArrayBuffer 失败：${err.name} - ${err.message}`);
        }
    }
    // ab.grow(newLength)：扩容（不可缩容，newLength 须 <= maxByteLength）
    _growBuffer() {
        if (!this._caps().resizableBuffer) {
            this._addLog('warn', 'Resizable ArrayBuffer 不可用，需 Node 22+');
            return;
        }
        if (!this._resizableBuffer) {
            this._addLog('warn', '请先点击「创建 Resizable ArrayBuffer」');
            return;
        }
        try {
            const ab = this._resizableBuffer;
            const before = ab.byteLength;
            new Uint8Array(ab).set([1, 2, 3, 4, 5, 6, 7, 8]); // 写入初始数据，grow 后应保留
            ab.grow(16); // 扩容到 16 字节（<= maxByteLength 32）
            const after = ab.byteLength;
            const head = Array.from(new Uint8Array(ab, 0, 8)); // [1..8] 保留
            const tail = Array.from(new Uint8Array(ab, 8, 8)); // 新区域为 0
            let shrinkLine = '';
            try {
                ab.grow(4);
            }
            catch (e) {
                shrinkLine = `\n尝试 grow(4) 缩容 → ${e.name}（grow 只能扩容，不能缩容）`;
            }
            this.setState({
                bufferResult: `ab.grow(16)（扩容，<= maxByteLength ${ab.maxByteLength}）\n` +
                    `  byteLength: ${before} → ${after}\n` +
                    `  grow 前 [1..8] 已写入，grow 后前 8 字节 = [${head.join(',')}]（数据保留）\n` +
                    `  新区域后 8 字节 = [${tail.join(',')}]（新增区域初始化为 0）\n` +
                    `  ab.resizable = ${ab.resizable}，ab.maxByteLength = ${ab.maxByteLength}${shrinkLine}\n\n` +
                    `说明：grow 只能扩容到 [当前长度, maxByteLength]；grow 后 ArrayBuffer 同一引用不变，\n` +
                    `  已有 TypedArray 视图保持有效（与 WebAssembly.Memory.grow 不同，后者换 buffer）。`,
            });
            this._addLog('buf', `grow(${before}→${after})：前 8 字节保留=[${head.join(',')}]，后 8 字节=[${tail.join(',')}]`);
        }
        catch (err) {
            this._addLog('warn', `grow 失败：${err.name} - ${err.message}`);
        }
    }
    // ab.transfer() / transferToFixedLength() / detached
    _transferBuffer() {
        if (!this._caps().transferBuffer) {
            this._addLog('warn', 'ArrayBuffer.prototype.transfer 不可用，需 Node 22+');
            return;
        }
        try {
            const ab = new ArrayBuffer(8, { maxByteLength: 32 });
            new Uint8Array(ab).set([10, 20, 30, 40, 50, 60, 70, 80]);
            const detachedBefore = ab.detached; // false
            const ab2 = ab.transfer(); // 转移数据，原 buffer 被分离
            const detachedAfter = ab.detached; // true
            const ab2Resizable = ab2.resizable; // true（继承 resizable + maxByteLength）
            const data = Array.from(new Uint8Array(ab2)); // [10..80] 数据已转移
            const ab3 = ab2.transferToFixedLength(); // 转为固定长度
            const ab3Resizable = ab3.resizable; // false
            const ab2Detached = ab2.detached; // true
            let accessOldLine = '';
            try {
                ab.byteLength;
            }
            catch (e) {
                accessOldLine = `\n访问已分离 (ab as any).byteLength → ${e.name}（detached 后无法访问）`;
            }
            this.setState({
                bufferResult: `ab = new ArrayBuffer(8, { maxByteLength: 32 })，写入 [10..80]\n\n` +
                    `ab.detached（转移前）= ${detachedBefore}\n` +
                    `const ab2 = ab.transfer() —— 转移数据，原 ab 分离\n` +
                    `  ab.detached（转移后）= ${detachedAfter}\n` +
                    `  ab2.resizable = ${ab2Resizable}（继承 resizable + maxByteLength）\n` +
                    `  new Uint8Array(ab2) = [${data.join(',')}]（数据完整转移）${accessOldLine}\n\n` +
                    `const ab3 = ab2.transferToFixedLength() —— 转为固定长度\n` +
                    `  ab3.resizable = ${ab3Resizable}（false：不可再 grow），ab2.detached = ${ab2Detached}\n\n` +
                    `说明：transfer 用于所有权转移（如跨 Worker 传递，避免拷贝）；\n` +
                    `  detached 后原 buffer 的 byteLength / 视图访问均抛 TypeError。`,
            });
            this._addLog('buf', `transfer：ab.detached=${detachedBefore}→${detachedAfter}，数据=[${data.join(',')}]；fixedLength resizable=${ab3Resizable}`);
        }
        catch (err) {
            this._addLog('warn', `transfer 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '5. Resizable ArrayBuffer + transfer（ES2024）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.resizableBuffer ? 'success' : 'error' }, caps.resizableBuffer ? 'resizable ✓' : 'resizable ✗'), h(Tag, { color: caps.transferBuffer ? 'success' : 'error' }, caps.transferBuffer ? 'transfer ✓' : 'transfer ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new ArrayBuffer(length, { maxByteLength }) 创建可调整大小的 ArrayBuffer；ab.resizable / ab.maxByteLength / ab.grow(newLength)（只能扩容到 maxByteLength，grow 后同一引用、数据保留、新区域填 0）。ab.transfer() 转移数据到新 ArrayBuffer 并使原 buffer detached；ab.transferToFixedLength() 转为不可调整的固定长度；ab.detached 判断是否已分离。SharedArrayBuffer 同理用 { maxByteLength } 创建可增长（growable）共享缓冲区。检测："resizable" in ArrayBuffer.prototype / typeof ArrayBuffer.prototype.transfer === "function"。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('创建 Resizable', { type: 'primary', size: 'sm', disabled: !caps.resizableBuffer, onClick: () => this._createResizableBuffer() }), this._btn('grow(扩容)', { size: 'sm', disabled: !caps.resizableBuffer, onClick: () => this._growBuffer() }), this._btn('transfer/detached', { size: 'sm', disabled: !caps.transferBuffer, onClick: () => this._transferBuffer() })),
                h('div', { class: 'fs-sm text-secondary' }, 'ArrayBuffer 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } }, h('code', {}, s.bufferResult || '（点击按钮演示 Resizable ArrayBuffer）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `const ab = new ArrayBuffer(8, { maxByteLength: 32 });
ab.resizable;        // true
ab.grow(16);         // 扩容到 16（<= 32），数据保留，新区域填 0
const ab2 = ab.transfer();           // 转移数据，原 ab.detached === true
const ab3 = ab2.transferToFixedLength(); // 转为不可调整（resizable=false）`)),
                h(Alert, {
                    type: 'warning',
                    message: 'grow 与 transfer 的关键区别',
                    description: 'grow 在原 ArrayBuffer 引用上扩容（同一对象，已有 TypedArray 视图仍有效，新区域填 0，只能扩不能缩）；transfer 把数据转移到新 ArrayBuffer 并分离原 buffer（原 buffer 的 byteLength/视图访问均抛 TypeError），用于所有权转移（如跨 Worker 零拷贝传递）。注意与 WebAssembly.Memory.grow 不同——后者会替换 memory.buffer 引用。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：Proxy + Reflect + Symbol ===================
    // new Proxy(target, handler) + Reflect 镜像陷阱 —— 响应式 / 日志 / 验证
    _proxyReflect() {
        if (!this._caps().proxy || !this._caps().reflect) {
            this._addLog('warn', 'Proxy / Reflect 不可用');
            return;
        }
        try {
            const target = { count: 0, name: 'counter' };
            const accesses = [];
            // handler 陷阱：get / set / has，内部用 Reflect 转发默认行为
            const handler = {
                get(obj, key, receiver) { accesses.push(`get:${String(key)}`); return Reflect.get(obj, key, receiver); },
                set(obj, key, value, receiver) {
                    accesses.push(`set:${String(key)}=${value}`);
                    if (key === 'count' && typeof value === 'number' && value < 0)
                        throw new RangeError('count 不能为负数');
                    return Reflect.set(obj, key, value, receiver);
                },
                has(obj, key) { accesses.push(`has:${String(key)}`); return Reflect.has(obj, key); },
            };
            const proxy = new Proxy(target, handler);
            this._proxy = proxy;
            // 触发陷阱
            const n = proxy.name; // get:name
            proxy.count = 5; // set:count=5
            const hasCount = 'count' in proxy; // has:count
            const reflectGet = Reflect.get(proxy, 'count'); // 5（Reflect 也走代理陷阱）
            const reflectOwn = Reflect.ownKeys(target); // ['count','name']
            let rejectLine = '';
            try {
                proxy.count = -1;
            }
            catch (e) {
                rejectLine = `\nset 拦截验证：proxy.count = -1 → ${e.name}（${e.message}）`;
            }
            this.setState({
                proxyResult: `new Proxy(target, handler) + Reflect 转发\n` +
                    `  target = { count:0, name:'counter' }\n` +
                    `  handler 陷阱：get / set / has（内部用 Reflect.get/set/has 转发）\n\n` +
                    `触发操作与陷阱记录：\n` +
                    `  proxy.name → ${JSON.stringify(n)}，proxy.count = 5，'count' in proxy → ${hasCount}\n` +
                    `  陷阱记录 = [${accesses.join(', ')}]\n\n` +
                    `Reflect.get(proxy, 'count') = ${reflectGet}（Reflect 也走代理陷阱）\n` +
                    `Reflect.ownKeys(target) = ${JSON.stringify(reflectOwn)}${rejectLine}\n\n` +
                    `说明：Proxy 陷阱与 Reflect 方法一一对应（get/set/has/ownKeys/deleteProperty/\n` +
                    `  defineProperty/getOwnPropertyDescriptor/getPrototypeOf/setPrototypeOf/\n` +
                    `  apply/construct/preventExtensions/isExtensible）。典型用途：Vue 3 reactive（响应式）、\n` +
                    `  数据验证、访问日志、虚拟属性。Reflect 提供默认转发，避免手动 obj[key] 触发递归。`,
            });
            this._addLog('proxy', `Proxy 陷阱触发 ${accesses.length} 次：[${accesses.join(', ')}]；count=-1 被拦截`);
        }
        catch (err) {
            this._addLog('warn', `Proxy/Reflect 失败：${err.name} - ${err.message}`);
        }
    }
    // Well-known Symbols：toPrimitive / toStringTag / hasInstance / isConcatSpreadable / species
    _symbols() {
        if (!this._caps().symbol) {
            this._addLog('warn', 'Symbol 不可用');
            return;
        }
        try {
            // 1) Symbol.toPrimitive：对象转原始值时的自定义行为
            const money = {
                amount: 99,
                [Symbol.toPrimitive](hint) {
                    if (hint === 'number')
                        return this.amount;
                    if (hint === 'string')
                        return `$${this.amount}`;
                    return `default:$${this.amount}`;
                },
            };
            const toNum = +money; // 99（hint='number'）
            const toStr = `${money}`; // '$99'（hint='string'）
            const toDef = money + ''; // 'default:$99'（hint='default'）
            // 2) Symbol.toStringTag：Object.prototype.toString 的自定义标签
            const tagged = { [Symbol.toStringTag]: 'MyCustom' };
            const tagStr = Object.prototype.toString.call(tagged); // '[object MyCustom]'
            // 3) Symbol.hasInstance：自定义 instanceof 行为
            const IsEven = { [Symbol.hasInstance](val) { return typeof val === 'number' && val % 2 === 0; } };
            const evenCheck = 4 instanceof IsEven; // true
            const oddCheck = 5 instanceof IsEven; // false
            // 4) Symbol.isConcatSpreadable：concat 是否展开
            const spreadable = [1, 2];
            spreadable[Symbol.isConcatSpreadable] = true;
            const notSpread = [3, 4];
            notSpread[Symbol.isConcatSpreadable] = false;
            const concatResult = [0].concat(spreadable, notSpread); // [0,1,2,[3,4]]
            // 5) Symbol.species：控制派生对象的构造器
            class MyArray extends Array {
                static get [Symbol.species]() { return Array; }
            }
            const ma = new MyArray(1, 2, 3);
            const mapped = ma.map((x) => x * 2);
            const mappedIsMyArray = mapped instanceof MyArray; // false（species=Array）
            const mappedIsArray = mapped instanceof Array; // true
            const lines = [
                'Symbol.toPrimitive：对象 → 原始值自定义',
                `  +money = ${toNum}（number）｜ \`\${money}\` = ${JSON.stringify(toStr)}（string）｜ money+'' = ${JSON.stringify(toDef)}（default）`,
                '',
                `Symbol.toStringTag：Object.prototype.toString.call({ [Symbol.toStringTag]:'MyCustom' }) = ${tagStr}`,
                '',
                `Symbol.hasInstance：(4 as any) instanceof IsEven = ${evenCheck}｜(5 as any) instanceof IsEven = ${oddCheck}`,
                '',
                `Symbol.isConcatSpreadable：[0].concat([1,2]可展开, [3,4]不展开) = ${JSON.stringify(concatResult)}`,
                '',
                'Symbol.species：class MyArray extends Array { static get [Symbol.species](){return Array;} }',
                `  ma.map((x: any) =>x*2) instanceof MyArray = ${mappedIsMyArray}（species=Array → 不派生 MyArray）｜ instanceof Array = ${mappedIsArray}`,
            ];
            this.setState({ proxyResult: lines.join('\n') });
            this._addLog('sym', `Symbol：toPrimitive(+${toNum})，toStringTag=${tagStr}，hasInstance=${evenCheck}，species 派生 MyArray=${mappedIsMyArray}`);
        }
        catch (err) {
            this._addLog('warn', `Symbol 演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '6. Proxy + Reflect + Well-known Symbols',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.proxy && caps.reflect ? 'success' : 'error' }, caps.proxy && caps.reflect ? 'Proxy/Reflect ✓' : '不可用'), h(Tag, { color: caps.symbol ? 'primary' : 'error' }, caps.symbol ? 'Symbol ✓' : 'Symbol ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new Proxy(target, handler) 创建代理，handler 陷阱（get/set/has/ownKeys/deleteProperty/apply/construct 等）拦截对 target 的操作；Reflect 对象提供与陷阱一一对应的静态方法，用于默认转发。Well-known Symbols：Symbol.toPrimitive 自定义对象转原始值；Symbol.toStringTag 自定义 [object Xxx]；Symbol.hasInstance 自定义 instanceof；Symbol.isConcatSpreadable 控制 concat 展开；Symbol.species 控制派生对象（如 Array.map）的构造器。Proxy/Reflect/Symbol 在所有现代环境可用。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('Proxy + Reflect', { type: 'primary', size: 'sm', disabled: !caps.proxy || !caps.reflect, onClick: () => this._proxyReflect() }), this._btn('Well-known Symbols', { size: 'sm', disabled: !caps.symbol, onClick: () => this._symbols() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Proxy / Symbol 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.proxyResult || '（点击按钮演示 Proxy/Reflect/Symbol）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } }, h('code', {}, `// Proxy + Reflect：响应式 / 验证
const p = new Proxy(target, {
  get(t, k, r) { return Reflect.get(t, k, r); },
  set(t, k, v, r) { /* 验证 */ return Reflect.set(t, k, v, r); },
});
// Symbol.toPrimitive：自定义 +obj / \`\${obj}\` / obj+''
const o = { [Symbol.toPrimitive](hint) { return hint==='number'?42:'x'; } };
// Symbol.species：控制 map/filter 返回的构造器
class MyArray extends Array { static get [Symbol.species](){ return Array; } }`)),
                h(Alert, {
                    type: 'info',
                    message: 'Proxy + Reflect 是元编程与响应式系统的基础',
                    description: 'Vue 3 的 reactive 用 Proxy 拦截 get/set 实现依赖收集与触发更新；Reflect 让陷阱能安全转发默认行为（避免手动 t[k] 触发自身陷阱递归）。Well-known Symbols 让对象能自定义语言层面的协议行为：toPrimitive 控制类型转换、hasInstance 控制 instanceof、species 控制派生构造器、toStringTag 控制 toString 标签。这些是 JS 元编程的核心能力。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板 ===================
    _renderLogPanel() {
        const s = this.state;
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)), s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'page api-lab-page' }, h('h2', { class: 'section-title' }, 'ES2023 / ES2024+ 新特性实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 ES2024 新特性：Set 新方法、Iterator Helpers、Array.fromAsync、Object/Map.groupBy、String.isWellFormed/toWellFormed、Promise.withResolvers、Resizable ArrayBuffer，以及 Proxy/Reflect/Symbol 元编程。需 Node 22+ / 较新浏览器。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=ModernES2024Page.js.map