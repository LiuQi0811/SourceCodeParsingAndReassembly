/// <reference lib="webworker" />
// compute.worker.ts —— Web Worker：演示脱离主线程的密集计算
// 演示 MDN：Worker、postMessage、MessagePort、performance.now
// 计算大数质数（埃氏筛法）
const self = globalThis;
self.onmessage = (e) => {
    const { type, payload } = e.data;
    if (type === 'sieve') {
        const n = payload || 5_000_000;
        const start = performance.now();
        const result = sieveOfEratosthenes(n);
        const elapsed = performance.now() - start;
        self.postMessage({
            type: 'sieve:result',
            payload: { max: n, count: result.count, largest: result.largest, elapsed },
        });
    }
    else if (type === 'fibonacci') {
        const n = payload || 40;
        const start = performance.now();
        const value = fib(n);
        const elapsed = performance.now() - start;
        self.postMessage({
            type: 'fibonacci:result',
            payload: { n, value: value.toString(), digits: value.toString().length, elapsed },
        });
    }
};
function sieveOfEratosthenes(n) {
    const sieve = new Uint8Array(n + 1);
    let count = 0;
    let largest = 0;
    for (let i = 2; i <= n; i++) {
        if (!sieve[i]) {
            count++;
            largest = i;
            for (let j = i * i; j <= n; j += i)
                sieve[j] = 1;
        }
    }
    return { count, largest };
}
// 大整数斐波那契（用 BigInt 演示）
function fib(n) {
    let a = 0n, b = 1n;
    for (let i = 0; i < n; i++) {
        [a, b] = [b, a + b];
    }
    return a;
}
export {};
//# sourceMappingURL=compute.worker.js.map