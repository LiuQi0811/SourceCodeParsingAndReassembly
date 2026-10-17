export type StoreListener<T extends object> = (state: T, changedPath: string) => void;

export interface Store<T extends object> {
  state: T;
  subscribe: (listener: StoreListener<T>) => () => void;
}

export function createStore<T extends object>(initialState: T): Store<T> {
  const listeners = new Set<StoreListener<T>>();
  const proxyCache = new WeakMap<object, Map<string, object>>();
  const pendingPaths = new Set<string>();
  let flushScheduled = false;

  // 同一次任务内的多次写入（splice、撤销还原）合并为一次通知，避免重复渲染。
  const flush = (): void => {
    flushScheduled = false;
    if (pendingPaths.size === 0) return;
    const changedPath = Array.from(pendingPaths).join(',');
    pendingPaths.clear();
    listeners.forEach((listener) => listener(proxyState, changedPath));
  };

  const queueEmit = (path: string): void => {
    pendingPaths.add(path);
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(flush);
  };

  // 按“目标对象 + 访问路径”缓存代理，保证引用稳定并避免每次读取都新建 Proxy。
  const createProxy = <S extends object>(value: S, path: string): S => {
    const cached = proxyCache.get(value)?.get(path);
    if (cached) return cached as S;

    const proxy = new Proxy(value, {
      get(target, property, receiver) {
        const result: unknown = Reflect.get(target, property, receiver);
        if (typeof result === 'object' && result !== null) {
          return createProxy(result, path === '' ? String(property) : `${path}.${String(property)}`);
        }
        return result;
      },
      set(target, property, newValue, receiver) {
        const previous: unknown = Reflect.get(target, property, receiver);
        const result = Reflect.set(target, property, newValue, receiver);
        if (!Object.is(previous, newValue)) {
          queueEmit(path === '' ? String(property) : `${path}.${String(property)}`);
        }
        return result;
      },
      deleteProperty(target, property) {
        const existed = Reflect.has(target, property);
        const result = Reflect.deleteProperty(target, property);
        if (existed) {
          queueEmit(path === '' ? String(property) : `${path}.${String(property)}`);
        }
        return result;
      },
    });

    const bucket = proxyCache.get(value) ?? new Map<string, object>();
    bucket.set(path, proxy);
    proxyCache.set(value, bucket);
    return proxy;
  };

  const proxyState = createProxy(initialState, '');

  return {
    state: proxyState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
