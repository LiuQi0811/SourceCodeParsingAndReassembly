import { describe, expect, it, vi } from 'vitest';
import { createCounter, formatCount } from './counter';

describe('createCounter', () => {
  it('默认初始值为 0', () => {
    expect(createCounter().get()).toBe(0);
  });

  it('可以指定初始值', () => {
    expect(createCounter(10).get()).toBe(10);
  });

  it('increment 默认 +1 并返回新值', () => {
    const counter = createCounter();
    expect(counter.increment()).toBe(1);
    expect(counter.get()).toBe(1);
  });

  it('increment 支持指定步长', () => {
    const counter = createCounter(2);
    expect(counter.increment(5)).toBe(7);
  });

  it('reset 回到初始值', () => {
    const counter = createCounter(3);
    counter.increment(4);
    counter.reset();
    expect(counter.get()).toBe(3);
  });

  it('订阅能收到每次变化', () => {
    const counter = createCounter();
    const listener = vi.fn();
    counter.subscribe(listener);
    counter.increment();
    counter.increment(5);
    counter.reset();
    expect(listener.mock.calls.map((call) => call[0])).toEqual([1, 6, 0]);
  });

  it('退订后不再通知', () => {
    const counter = createCounter();
    const listener = vi.fn();
    const stop = counter.subscribe(listener);
    counter.increment();
    stop();
    counter.increment();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('退订函数返回 void，可直接当 React effect cleanup', () => {
    const counter = createCounter();
    const stop = counter.subscribe(() => undefined);
    expect(stop()).toBeUndefined();
  });

  it('formatCount 输出统一文案', () => {
    expect(formatCount(0)).toBe('当前点击：0 次');
    expect(formatCount(7)).toBe('当前点击：7 次');
  });
});
