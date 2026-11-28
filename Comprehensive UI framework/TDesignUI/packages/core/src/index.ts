// @tdesignui/core —— 纯 TS，禁止 import vue / react / tdesign-*
// 这里是 Vue 与 React 两端的唯一真相：领域规则、常量、数据结构。

export const APP_SPEC = {
  product: 'TDesign UI',
  version: '1.0.0',
  tagline: 'Vue 3 与 React 19 共用同一份领域逻辑',
} as const;

export type Unsubscribe = () => void;

export interface CounterStore {
  get: () => number;
  increment: (step?: number) => number;
  reset: () => void;
  subscribe: (listener: (value: number) => void) => Unsubscribe;
}

/** 框架无关的计数器：Vue 里 watch，React 里 useEffect 订阅即可 */
export function createCounter(initial = 0): CounterStore {
  let value = initial;
  const listeners = new Set<(value: number) => void>();

  const emit = () => listeners.forEach((listener) => listener(value));

  return {
    get: () => value,
    increment: (step = 1) => {
      value += step;
      emit();
      return value;
    },
    reset: () => {
      value = initial;
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
