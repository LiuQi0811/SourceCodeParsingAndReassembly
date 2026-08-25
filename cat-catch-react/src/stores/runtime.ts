import { create } from 'zustand';

/**
 * Runtime Store —— 还原原项目运行时临时状态(不持久化)
 * - G.urlMap          -> urlMap: Map<tabId, Set<url>>(URL 查重)
 * - G.requestHeaders  -> requestHeaders: Map<requestId, headers>(临时请求头)
 * - G.blackList       -> blackList: Set<requestId>(正则屏蔽资源)
 * 注:G.blockUrlSet / G.damnUrlSet / G.scriptList 已在 settings store 中管理
 */
interface RuntimeState {
  urlMap: Map<number, Set<string>>;
  requestHeaders: Map<string, Array<{ name: string; value?: string }> | Record<string, string>>;
  blackList: Set<string>;
  /** 防抖计数(还原 background.js 第 31-33 行) */
  debounceTimer: ReturnType<typeof setTimeout> | undefined;
  debounceCount: number;
  debounceTime: number;
}

interface RuntimeActions {
  /** URL 查重 - 按 tabId 分桶(还原 background.js 第 221-231 行) */
  hasUrl: (tabId: number, url: string) => boolean;
  addUrl: (tabId: number, url: string, maxBucketSize?: number) => void;
  clearTabUrls: (tabId: number) => void;
  setRequestHeaders: (
    requestId: string,
    headers: Array<{ name: string; value?: string }> | Record<string, string>,
  ) => void;
  getRequestHeaders: (
    requestId: string,
  ) => Array<{ name: string; value?: string }> | Record<string, string> | undefined;
  deleteRequestHeaders: (requestId: string) => void;
  addBlackList: (requestId: string) => void;
  hasBlackList: (requestId: string) => boolean;
  deleteBlackList: (requestId: string) => void;
  clearAll: () => void;
  setDebounce: (timer: ReturnType<typeof setTimeout> | undefined, count?: number, time?: number) => void;
  /** 清理超过 10240 项的 requestHeaders(还原 background.js 第 1100-1102 行) */
  pruneRequestHeaders: () => void;
}

export type RuntimeStore = RuntimeState & RuntimeActions;

export const useRuntimeStore = create<RuntimeStore>((set, get) => ({
  urlMap: new Map(),
  requestHeaders: new Map(),
  blackList: new Set(),
  debounceTimer: undefined,
  debounceCount: 0,
  debounceTime: 0,

  hasUrl: (tabId, url) => get().urlMap.get(tabId)?.has(url) ?? false,

  addUrl: (tabId, url, maxBucketSize = 500) => {
    const next = new Map(get().urlMap);
    let bucket = next.get(tabId) ?? new Set<string>();
    if (bucket.has(url)) return;
    bucket = new Set(bucket);
    bucket.add(url);
    if (bucket.size >= maxBucketSize) bucket.clear();
    next.set(tabId, bucket);
    set({ urlMap: next });
  },

  clearTabUrls: (tabId) =>
    set((s) => {
      if (!s.urlMap.has(tabId)) return s;
      const next = new Map(s.urlMap);
      next.delete(tabId);
      return { urlMap: next };
    }),

  setRequestHeaders: (requestId, headers) =>
    set((s) => {
      const next = new Map(s.requestHeaders);
      next.set(requestId, headers);
      return { requestHeaders: next };
    }),

  getRequestHeaders: (requestId) => get().requestHeaders.get(requestId),

  deleteRequestHeaders: (requestId) =>
    set((s) => {
      if (!s.requestHeaders.has(requestId)) return s;
      const next = new Map(s.requestHeaders);
      next.delete(requestId);
      return { requestHeaders: next };
    }),

  addBlackList: (requestId) =>
    set((s) => {
      const next = new Set(s.blackList);
      next.add(requestId);
      return { blackList: next };
    }),

  hasBlackList: (requestId) => get().blackList.has(requestId),

  deleteBlackList: (requestId) =>
    set((s) => {
      if (!s.blackList.has(requestId)) return s;
      const next = new Set(s.blackList);
      next.delete(requestId);
      return { blackList: next };
    }),

  clearAll: () =>
    set({
      urlMap: new Map(),
      requestHeaders: new Map(),
      blackList: new Set(),
    }),

  setDebounce: (timer, count = 0, time = 0) =>
    set({ debounceTimer: timer, debounceCount: count, debounceTime: time }),

  pruneRequestHeaders: () =>
    set((s) => {
      if (s.requestHeaders.size < 10240) return s;
      return { requestHeaders: new Map() };
    }),
}));
