import { create } from 'zustand';

/**
 * Media 数据模型 —— 还原原 background.js 的 cacheData 媒体项
 * 1:1 还原原项目第 241-255 行的 info 结构
 */
export interface MediaItem {
  name?: string;
  url: string;
  size?: number;
  ext?: string;
  type?: string;
  tabId: number;
  isRegex?: boolean;
  requestId: string;
  initiator?: string;
  requestHeaders?: Record<string, string>;
  cookie?: string;
  getTime?: number;
  /** 装载页面信息(原 info.title / favIconUrl / webUrl) */
  title?: string;
  favIconUrl?: string;
  webUrl?: string;
  /** 正则匹配的备注扩展 */
  extraExt?: string;
  /** mime(原 data.mime) */
  mime?: string;
  /** 解析器路径(用于 openParser) */
  parsing?: 'm3u8' | 'mpd';
  /** popup 端的 UI 状态(独立于原项目) */
  selected?: boolean;
  hidden?: boolean;
}

interface MediaState {
  /**
   * 按 tabId 分桶(还原原 cacheData[tabId])
   * 注意:存储 chrome.storage 时需序列化为普通对象
   */
  buckets: Map<number, MediaItem[]>;
  /** 原 cacheData.init 标志(初次未加载完时为 true) */
  initialized: boolean;
}

interface MediaActions {
  /** 添加到指定 tab(还原 cacheData[tabId].push) */
  push: (item: MediaItem) => boolean;
  /** 移除单条(按 tabId + requestId) */
  remove: (tabId: number, requestId: string) => void;
  /** 清空某 tab(还原 delete cacheData[tabId]) */
  clearTab: (tabId: number) => void;
  /** 清空除指定 tab 外的其他 tab(还原 clearData other) */
  clearOtherTabs: (keepTabId: number) => void;
  /** 清空全部 */
  clearAll: () => void;
  /** 获取某 tab 数据(还原 getData by tabId) */
  getByTab: (tabId: number) => MediaItem[];
  /** 按 requestId 数组查(还原 getData by requestId[]) */
  getByRequestIds: (requestIds: string[]) => MediaItem[];
  /** 获取全部数据(还原 getAllData) */
  getAll: () => Record<number, MediaItem[]>;
  /** 从 chrome.storage 加载 cacheData(还原 init.js MediaData 加载) */
  loadFromStorage: () => Promise<void>;
  /** 持久化到 chrome.storage(还原 alarms save) */
  persist: () => Promise<void>;
  /** 主动持久化(还原 pushData 消息) */
  forcePersist: () => Promise<void>;
  /** 标记初始化完成 */
  setInitialized: (v: boolean) => void;
  /** UI:切换某条媒体在 popup 中的选中态(不持久化) */
  toggleSelected: (tabId: number, requestId: string) => void;
  /** UI:批量设置某 tab 列表的选中态(不持久化) */
  setSelectedAll: (tabId: number, value: boolean) => void;
  /** UI:反选某 tab 列表(不持久化,还原原 popup.js invertSelection) */
  invertSelection: (tabId: number) => void;
}

export type MediaStore = MediaState & MediaActions;

const INITIAL: MediaState = {
  buckets: new Map(),
  initialized: true, // 默认 true,SW 重启时会被 loadFromStorage 重置
};

export const useMediaStore = create<MediaStore>((set, get) => ({
  ...INITIAL,

  push: (item) => {
    const { buckets, initialized } = get();
    if (!initialized) return false;
    const next = new Map(buckets);
    const list = next.get(item.tabId) ?? [];
    if (list.some((m) => m.requestId === item.requestId && m.url === item.url)) {
      return false; // 已存在
    }
    next.set(item.tabId, [...list, item]);
    set({ buckets: next });
    return true;
  },

  remove: (tabId, requestId) =>
    set((s) => {
      const list = s.buckets.get(tabId);
      if (!list) return s;
      const next = new Map(s.buckets);
      const filtered = list.filter((m) => m.requestId !== requestId);
      if (filtered.length === 0) {
        next.delete(tabId);
      } else {
        next.set(tabId, filtered);
      }
      return { buckets: next };
    }),

  clearTab: (tabId) =>
    set((s) => {
      if (!s.buckets.has(tabId)) return s;
      const next = new Map(s.buckets);
      next.delete(tabId);
      return { buckets: next };
    }),

  clearOtherTabs: (keepTabId) =>
    set((s) => {
      const next = new Map<number, MediaItem[]>();
      const keep = s.buckets.get(keepTabId);
      if (keep) next.set(keepTabId, keep);
      return { buckets: next };
    }),

  clearAll: () => set({ buckets: new Map() }),

  getByTab: (tabId) => get().buckets.get(tabId) ?? [],

  getByRequestIds: (requestIds) => {
    const result: MediaItem[] = [];
    const set_ = new Set(requestIds);
    for (const list of get().buckets.values()) {
      for (const m of list) {
        if (set_.has(m.requestId)) result.push(m);
      }
    }
    return result;
  },

  getAll: () => {
    const obj: Record<number, MediaItem[]> = {};
    for (const [k, v] of get().buckets) obj[k] = v;
    return obj;
  },

  loadFromStorage: async () => {
    const area = chrome.storage.session ?? chrome.storage.local;
    const data = await area.get('MediaData');
    if (data.MediaData?.init) {
      set({ buckets: new Map(), initialized: true });
      return;
    }
    const buckets = new Map<number, MediaItem[]>();
    if (data.MediaData) {
      // 反序列化(原项目存的是普通 object,这里转回 Map)
      const raw = data.MediaData.buckets ?? data.MediaData;
      for (const key in raw) {
        const tabId = Number(key);
        if (!Number.isNaN(tabId) && Array.isArray(raw[key])) {
          buckets.set(tabId, raw[key]);
        }
      }
    }
    set({ buckets, initialized: true });
  },

  persist: async () => {
    const { buckets } = get();
    // 序列化为普通对象(chrome.storage 不支持 Map)
    const obj: Record<number, MediaItem[]> = {};
    for (const [k, v] of buckets) obj[k] = v;
    const area = chrome.storage.session ?? chrome.storage.local;
    await area.set({ MediaData: { buckets: obj, init: false } });
  },

  forcePersist: async () => get().persist(),

  setInitialized: (v) => set({ initialized: v }),

  toggleSelected: (tabId, requestId) =>
    set((s) => {
      const list = s.buckets.get(tabId);
      if (!list) return s;
      const idx = list.findIndex((m) => m.requestId === requestId);
      if (idx === -1) return s;
      const item = list[idx];
      if (!item) return s;
      const nextList = list.slice();
      nextList[idx] = { ...item, selected: !item.selected };
      const next = new Map(s.buckets);
      next.set(tabId, nextList);
      return { buckets: next };
    }),

  setSelectedAll: (tabId, value) =>
    set((s) => {
      const list = s.buckets.get(tabId);
      if (!list || list.length === 0) return s;
      const nextList = list.map((m) => ({ ...m, selected: value }));
      const next = new Map(s.buckets);
      next.set(tabId, nextList);
      return { buckets: next };
    }),

  invertSelection: (tabId) =>
    set((s) => {
      const list = s.buckets.get(tabId);
      if (!list || list.length === 0) return s;
      const nextList = list.map((m) => ({ ...m, selected: !m.selected }));
      const next = new Map(s.buckets);
      next.set(tabId, nextList);
      return { buckets: next };
    }),
}));
