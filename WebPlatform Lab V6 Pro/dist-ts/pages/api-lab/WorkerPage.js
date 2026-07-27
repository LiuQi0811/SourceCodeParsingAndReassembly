// WorkerPage.ts —— Web Worker 实验室：主线程 vs Worker 对比
// 演示 MDN：Worker、postMessage、BigInt、Uint8Array、performance.now、Transferable
import { Page } from '../../core/Component.js';
import { h, formatTime, formatDuration } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import { Input } from '../../components/ui/Input.js';
import { message } from '../../components/ui/Message.js';
// 主线程版本：埃氏筛
function sieveMain(n) {
    const sieve = new Uint8Array(n + 1);
    let count = 0;
    for (let i = 2; i <= n; i++) {
        if (!sieve[i]) {
            count++;
            for (let j = i * i; j <= n; j += i)
                sieve[j] = 1;
        }
    }
    return count;
}
// 主线程版本：fib（BigInt）
function fibMain(n) {
    let a = 0n, b = 1n;
    for (let i = 0; i < n; i++) {
        [a, b] = [b, a + b];
    }
    return a.toString();
}
export class WorkerPage extends Page {
    _worker = null;
    _onWorkerMessage = null;
    initialState() {
        return {
            sieveN: 5_000_000,
            fibN: 1000,
            running: false,
            results: [],
        };
    }
    componentDidMount() {
        this._worker = new Worker('./workers/compute.worker.js');
        this._onWorkerMessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'sieve:result') {
                this._append('info', `Worker sieve 完成 → ${payload.count} 个素数，耗时 ${formatDuration(payload.elapsed ?? 0)}`);
                this.setState((s) => ({
                    results: [...s.results, { task: 'sieve (Worker)', result: payload.count ?? 0, elapsed: payload.elapsed ?? 0, time: formatTime() }].slice(-8),
                    running: false,
                }));
            }
            else if (type === 'fibonacci:result') {
                this._append('info', `Worker fibonacci 完成 → ${payload.digits} 位，耗时 ${formatDuration(payload.elapsed ?? 0)}`);
                this.setState((s) => ({
                    results: [...s.results, { task: 'fib (Worker)', result: payload.value ?? '', elapsed: payload.elapsed ?? 0, time: formatTime() }].slice(-8),
                    running: false,
                }));
            }
        };
        this._worker.addEventListener('message', this._onWorkerMessage);
        this._worker.addEventListener('error', (err) => {
            this._append('error', `Worker error: ${err.message}`);
            this.setState({ running: false });
        });
    }
    componentWillUnmount() {
        if (this._worker && this._onWorkerMessage) {
            this._worker.removeEventListener('message', this._onWorkerMessage);
        }
        this._worker?.terminate();
        this._worker = null;
    }
    _append(type, content) {
        // 简易：用 message 提示，不入 state（避免过度重渲染）
        if (type === 'error')
            message.error(content);
        else
            message.info(content);
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    async _runSieveCompare() {
        if (this.state.running)
            return;
        const n = Number(this.state.sieveN);
        this.setState({ running: true });
        // 主线程
        this._append('info', `主线程开始 sieve(${n})...`);
        const t1 = performance.now();
        const mainCount = sieveMain(n);
        const mainElapsed = performance.now() - t1;
        this._append('info', `主线程 sieve 完成 → ${mainCount} 个素数，耗时 ${formatDuration(mainElapsed)}`);
        // Worker
        this._append('info', `Worker 开始 sieve(${n})...`);
        this._worker?.postMessage({ type: 'sieve', payload: n });
        this.setState((s) => ({
            results: [...s.results, { task: 'sieve (主线程)', result: mainCount, elapsed: mainElapsed, time: formatTime() }].slice(-8),
        }));
    }
    async _runFibCompare() {
        if (this.state.running)
            return;
        const n = Number(this.state.fibN);
        this.setState({ running: true });
        this._append('info', `主线程开始 fib(${n})...`);
        const t1 = performance.now();
        const mainResult = fibMain(n);
        const mainElapsed = performance.now() - t1;
        this._append('info', `主线程 fib 完成 → ${mainResult.length} 位，耗时 ${formatDuration(mainElapsed)}`);
        this._append('info', `Worker 开始 fib(${n})...`);
        this._worker?.postMessage({ type: 'fibonacci', payload: n });
        this.setState((s) => ({
            results: [...s.results, { task: 'fib (主线程)', result: mainResult, elapsed: mainElapsed, time: formatTime() }].slice(-8),
        }));
    }
    renderPage() {
        const sieveInput = new Input({
            value: String(this.state.sieveN), size: 'sm', style: { width: '140px' },
            onChange: (v) => { this.state.sieveN = Number(v) || 5_000_000; },
        });
        this.registerChild(sieveInput);
        const fibInput = new Input({
            value: String(this.state.fibN), size: 'sm', style: { width: '100px' },
            onChange: (v) => { this.state.fibN = Number(v) || 1000; },
        });
        this.registerChild(fibInput);
        return [
            h('h2', { class: 'section-title' }, 'Web Worker 实验室'),
            h(Alert, {
                type: 'info',
                message: 'Worker / postMessage / BigInt / Uint8Array',
                description: '对比「主线程」与「Worker 线程」执行相同任务。Worker 在后台独立运行，不阻塞 UI。任务返回耗时（performance.now）与结果。',
            }),
            // 操作面板
            h(Card, { title: '任务面板', extra: h(Tag, { color: this.state.running ? 'error' : 'success' }, this.state.running ? '运行中' : '空闲') }, h('div', { class: 'flex flex-col gap-md' }, 
            // 埃氏筛
            h('div', { class: 'flex items-center gap-sm flex-wrap' }, h('span', { class: 'fw-medium' }, '埃氏筛'), h('span', { class: 'fs-sm text-secondary' }, 'N'), sieveInput.render(), this._btn('主线程 vs Worker 对比', {
                type: 'primary', size: 'sm',
                onClick: () => this._runSieveCompare(),
                disabled: this.state.running,
            })), 
            // fib
            h('div', { class: 'flex items-center gap-sm flex-wrap' }, h('span', { class: 'fw-medium' }, 'Fibonacci（BigInt）'), h('span', { class: 'fs-sm text-secondary' }, 'N'), fibInput.render(), this._btn('主线程 vs Worker 对比', {
                type: 'primary', size: 'sm',
                onClick: () => this._runFibCompare(),
                disabled: this.state.running,
            })), h('p', { class: 'fs-sm text-tertiary' }, '提示：在 Worker 运行期间，尝试拖动页面、点击按钮 —— UI 不会卡顿；而主线程版本运行时会冻结界面。'))),
            // 结果对比表
            h(Card, { title: '执行结果对比', extra: h(Tag, { color: 'primary' }, `${this.state.results.length} 条`) }, this.state.results.length === 0
                ? h('div', { class: 'fs-sm text-tertiary' }, '尚未执行任务，点击上方按钮开始')
                : h('div', { class: 'log-panel' }, ...this.state.results.map((r) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, r.time), h('span', { class: 'log-panel__tag log-panel__tag--push' }, r.task), h('span', {}, `耗时 ${formatDuration(r.elapsed)}  ·  结果长度 ${String(r.result).length}`))))),
            // 代码片段
            h(Card, { title: 'compute.worker.js 关键代码' }, h('pre', { class: 'code-block' }, `// 主线程
const worker = new Worker('./compute.worker.js', { type: 'module' });
worker.postMessage({ task: 'sieve', n: 5_000_000 });
worker.onmessage = (e: any) => {
  const { result, elapsed } = e.data;
  console.log('完成', result, elapsed);
};

// Worker 内部（workers/compute.worker.js）
self.onmessage = (e: any) => {
  const { task, n } = e.data;
  const start = performance.now();
  // ... 计算 ...
  self.postMessage({ type: 'result', task, result, elapsed: performance.now() - start });
};`)),
        ];
    }
}
//# sourceMappingURL=WorkerPage.js.map