// 计数器：框架无关的状态容器示例
export type Unsubscribe = () => void;

export interface CounterStore {
  get: () => number;
  increment: (step?: number) => number;
  reset: () => void;
  subscribe: (listener: (value: number) => void) => Unsubscribe;
}

/** 文案也归 core 管：两端渲染的字符串由同一段逻辑生成，不会各写一份走样 */
export function formatCount(value: number): string {
  return `当前点击：${value} 次`;
}

/** 框架无关的计数器：Vue 里 onUnmounted 退订，React 里 useEffect 返回退订函数 */
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
      // 显式返回 void，保证能直接当作 React 的 effect cleanup 使用
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
