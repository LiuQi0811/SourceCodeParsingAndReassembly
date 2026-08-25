import { create } from 'zustand';
import type {
  ExtRule,
  TypeRule,
  RegexRule,
  CompiledRegexRule,
  BlockUrlRuleRaw,
  CompiledBlockUrlRule,
  ScriptEntry,
  FfmpegConfig,
  Operator,
} from '@lib/config';
import {
  DEFAULT_EXT_RULES,
  DEFAULT_TYPE_RULES,
  DEFAULT_REGEX_RULES,
  DEFAULT_DAMN_URL_PATTERNS,
  DEFAULT_OPTIONS,
  DEFAULT_LOCAL_VAR,
  DEFAULT_SCRIPT_LIST,
  createFfmpegConfig,
} from '@lib/config';

/**
 * 工具:把 Array<{ext|type, ...}> 转为 Map,并解析 '~' 操作符的 min/max
 * 还原原 init.js 第 249-267 行的 items.Ext = new Map(items.Ext.map(...))
 */
function toExtMap(rules: ExtRule[]): Map<string, ExtRule> {
  return new Map(
    rules.map((item) => {
      const next = { ...item };
      if (next.operator === undefined) next.operator = '>=' as Operator;
      if (next.operator === '~') {
        const [min, max] = String(next.size).split('-');
        next.min = min ? parseInt(min, 10) : 0;
        next.max = max ? parseInt(max, 10) : 0;
      }
      return [item.ext, next];
    }),
  );
}

function toTypeMap(rules: TypeRule[]): Map<string, TypeRule> {
  return new Map(
    rules.map((item) => {
      const next = { ...item };
      if (next.operator === undefined) next.operator = '>=' as Operator;
      if (next.operator === '~') {
        const [min, max] = String(next.size).split('-');
        next.min = min ? parseInt(min, 10) : 0;
        next.max = max ? parseInt(max, 10) : 0;
      }
      return [item.type, next];
    }),
  );
}

/** 预编译 Regex 数组(还原 init.js 第 269-273 行) */
function compileRegex(rules: RegexRule[]): CompiledRegexRule[] {
  return rules.map((item) => {
    let regex: RegExp | undefined;
    try {
      regex = new RegExp(item.regex, item.type);
    } catch {
      return { regex: /(?:)/, ext: item.ext, blackList: !!item.blackList, state: false };
    }
    return { regex, ext: item.ext, blackList: !!item.blackList, state: item.state };
  });
}

/** 预编译 blockUrl 通配符(还原 init.js 第 275-277 行) */
function compileBlockUrl(rules: BlockUrlRuleRaw[]): CompiledBlockUrlRule[] {
  return rules.map((item) => ({
    url: wildcardToRegex(item.url),
    state: item.state,
  }));
}

/** 通配符 -> RegExp(还原 init.js 第 439-449 行) */
function wildcardToRegex(urlPattern: string): RegExp {
  const regexPattern = urlPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`, 'i');
}

/**
 * Settings Store —— 完整还原原项目全局对象 G
 * - 启动时从 chrome.storage.sync 读取配置
 * - 监听 chrome.storage.onChanged 自动同步
 */
export interface SettingsState {
  // === 运行时初始化标志 ===
  initSyncComplete: boolean;
  initLocalComplete: boolean;

  // === 平台 ===
  tabId: number; // 当前活动 tab(原 G.tabId)
  isMobile: boolean; // 原 G.isMobile
  isFirefox: boolean; // 原 G.isFirefox
  version: number; // 原 G.version(Chrome 主版本号)

  // === OptionLists - 集合类型 ===
  Ext: Map<string, ExtRule>; // 注意:是 Map,不是 Array
  Type: Map<string, TypeRule>;
  Regex: CompiledRegexRule[];
  blockUrl: CompiledBlockUrlRule[];

  // === OptionLists - 标量(同步到 chrome.storage.sync) ===
  options: typeof DEFAULT_OPTIONS;

  // === LocalVar(同步到 chrome.storage.local / session) ===
  featMobileTabId: Set<number>;
  featAutoDownTabId: Set<number>;
  mediaControl: { tabid: number; index: number };
  previewShowTitle: boolean;
  previewDeleteDuplicateFilenames: boolean;
  M3u8HideDownloadedSegments: boolean;

  // === 运行时集合 ===
  enable: boolean; // 原 G.enable,与 options.enable 同步
  damnUrl: RegExp[]; // 硬编码避免抓取列表(原 G.damnUrl)
  damnUrlSet: Set<number>; // tabId 级别避免抓取(原 G.damnUrlSet)
  blockUrlSet: Set<number>; // tabId 级别屏蔽(原 G.blockUrlSet)
  blockUrlWhite: boolean; // 白名单模式(原 G.blockUrlWhite)
  scriptList: Map<string, ScriptEntry>; // 原 G.scriptList
  ffmpegConfig: FfmpegConfig; // 原 G.ffmpegConfig
  deepSearchTemporarilyClose: number | null; // 原 G.deepSearchTemporarilyClose
}

interface SettingsActions {
  setTabId: (id: number) => void;
  setEnable: (v: boolean) => void;
  setInitSyncComplete: (v: boolean) => void;
  setInitLocalComplete: (v: boolean) => void;
  setExtRules: (rules: ExtRule[]) => void;
  setTypeRules: (rules: TypeRule[]) => void;
  setRegexRules: (rules: RegexRule[]) => void;
  setBlockUrl: (rules: BlockUrlRuleRaw[]) => void;
  updateOptions: (patch: Partial<typeof DEFAULT_OPTIONS>) => void;
  addBlockUrlTab: (tabId: number) => void;
  removeBlockUrlTab: (tabId: number) => void;
  addDamnUrlTab: (tabId: number) => void;
  removeDamnUrlTab: (tabId: number) => void;
  addFeatMobileTab: (tabId: number) => void;
  removeFeatMobileTab: (tabId: number) => void;
  addFeatAutoDownTab: (tabId: number) => void;
  removeFeatAutoDownTab: (tabId: number) => void;
  setDeepSearchClose: (v: number | null) => void;
  toggleScriptTab: (script: string, tabId: number) => boolean;
  hasScriptTab: (script: string, tabId: number) => boolean;
  /** 从 chrome.storage.sync 加载(还原 init.js InitOptions 的 sync 部分) */
  loadFromSync: () => Promise<void>;
  /** 从 chrome.storage.local 加载(还原 init.js InitOptions 的 local 部分) */
  loadFromLocal: () => Promise<void>;
  /** 持久化 options + Ext/Type/Regex/blockUrl 到 storage.sync */
  persistOptions: () => Promise<void>;
}

export type SettingsStore = SettingsState & SettingsActions;

// 是否为 Firefox(还原 init.js 第 192 行)
const isFirefox =
  typeof navigator !== 'undefined' &&
  navigator.userAgent.includes('Firefox') &&
  typeof (globalThis as any).browser !== 'undefined' &&
  !!(globalThis as any).browser?.runtime?.getBrowserInfo;

// Chrome 主版本号(还原 init.js 第 193-194 行)
function detectVersion(): number {
  if (typeof navigator === 'undefined') return 93;
  const m = navigator.userAgent.match(/(?:Chrome|Firefox)\/([\d]+)/);
  return m && m[1] ? parseInt(m[1], 10) : 93;
}

const isMobile =
  typeof navigator !== 'undefined' &&
  /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);

const INITIAL_OPTIONS = { ...DEFAULT_OPTIONS };

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  initSyncComplete: false,
  initLocalComplete: false,
  tabId: -1,
  isMobile,
  isFirefox,
  version: detectVersion(),

  // 编译默认值
  Ext: toExtMap(DEFAULT_EXT_RULES),
  Type: toTypeMap(DEFAULT_TYPE_RULES),
  Regex: compileRegex(DEFAULT_REGEX_RULES),
  blockUrl: compileBlockUrl([]),

  options: INITIAL_OPTIONS,

  featMobileTabId: new Set(),
  featAutoDownTabId: new Set(),
  mediaControl: { ...DEFAULT_LOCAL_VAR.mediaControl },
  previewShowTitle: false,
  previewDeleteDuplicateFilenames: false,
  M3u8HideDownloadedSegments: true,

  enable: true,
  damnUrl: DEFAULT_DAMN_URL_PATTERNS,
  damnUrlSet: new Set(),
  blockUrlSet: new Set(),
  blockUrlWhite: false,
  scriptList: new Map(
    DEFAULT_SCRIPT_LIST.map(([name, entry]) => [
      name,
      { ...entry, tabId: new Set<number>() } as ScriptEntry,
    ]),
  ),
  ffmpegConfig: createFfmpegConfig(0),
  deepSearchTemporarilyClose: null,

  setTabId: (id) => set({ tabId: id }),
  setEnable: (v) => {
    set({ enable: v, options: { ...get().options, enable: v } });
    void chrome.storage.sync.set({ enable: v });
    chrome.action.setIcon({
      path: v ? '/img/icon.png' : '/img/icon-disable.png',
    });
  },
  setInitSyncComplete: (v) => set({ initSyncComplete: v }),
  setInitLocalComplete: (v) => set({ initLocalComplete: v }),

  setExtRules: (rules) => set({ Ext: toExtMap(rules) }),
  setTypeRules: (rules) => set({ Type: toTypeMap(rules) }),
  setRegexRules: (rules) => set({ Regex: compileRegex(rules) }),
  setBlockUrl: (rules) => set({ blockUrl: compileBlockUrl(rules) }),

  updateOptions: (patch) =>
    set((s) => ({ options: { ...s.options, ...patch } })),

  addBlockUrlTab: (tabId) =>
    set((s) => {
      const next = new Set(s.blockUrlSet);
      next.add(tabId);
      return { blockUrlSet: next };
    }),
  removeBlockUrlTab: (tabId) =>
    set((s) => {
      const next = new Set(s.blockUrlSet);
      next.delete(tabId);
      return { blockUrlSet: next };
    }),
  addDamnUrlTab: (tabId) =>
    set((s) => {
      const next = new Set(s.damnUrlSet);
      next.add(tabId);
      return { damnUrlSet: next };
    }),
  removeDamnUrlTab: (tabId) =>
    set((s) => {
      const next = new Set(s.damnUrlSet);
      next.delete(tabId);
      return { damnUrlSet: next };
    }),
  addFeatMobileTab: (tabId) =>
    set((s) => {
      const next = new Set(s.featMobileTabId);
      next.add(tabId);
      return { featMobileTabId: next };
    }),
  removeFeatMobileTab: (tabId) =>
    set((s) => {
      const next = new Set(s.featMobileTabId);
      next.delete(tabId);
      return { featMobileTabId: next };
    }),
  addFeatAutoDownTab: (tabId) =>
    set((s) => {
      const next = new Set(s.featAutoDownTabId);
      next.add(tabId);
      return { featAutoDownTabId: next };
    }),
  removeFeatAutoDownTab: (tabId) =>
    set((s) => {
      const next = new Set(s.featAutoDownTabId);
      next.delete(tabId);
      return { featAutoDownTabId: next };
    }),
  setDeepSearchClose: (v) => set({ deepSearchTemporarilyClose: v }),

  toggleScriptTab: (script, tabId) => {
    const s = get();
    const entry = s.scriptList.get(script);
    if (!entry) return false;
    const next = new Map(s.scriptList);
    const nextEntry = { ...entry, tabId: new Set(entry.tabId) };
    if (nextEntry.tabId.has(tabId)) {
      nextEntry.tabId.delete(tabId);
    } else {
      nextEntry.tabId.add(tabId);
    }
    next.set(script, nextEntry);
    set({ scriptList: next });
    return true;
  },

  hasScriptTab: (script, tabId) => {
    const entry = get().scriptList.get(script);
    return entry ? entry.tabId.has(tabId) : false;
  },

  loadFromSync: async () => {
    const data = await chrome.storage.sync.get({
      ...DEFAULT_OPTIONS,
      Ext: DEFAULT_EXT_RULES,
      Type: DEFAULT_TYPE_RULES,
      Regex: DEFAULT_REGEX_RULES,
      blockUrl: [] as BlockUrlRuleRaw[],
    });

    // 确保默认值
    for (const key in DEFAULT_OPTIONS) {
      if (data[key as keyof typeof data] === undefined || data[key as keyof typeof data] === null) {
        (data as any)[key] = (DEFAULT_OPTIONS as any)[key];
      }
    }

    const patch: Partial<SettingsState> = {
      Ext: toExtMap((data.Ext as ExtRule[]) ?? DEFAULT_EXT_RULES),
      Type: toTypeMap((data.Type as TypeRule[]) ?? DEFAULT_TYPE_RULES),
      Regex: compileRegex((data.Regex as RegexRule[]) ?? DEFAULT_REGEX_RULES),
      blockUrl: compileBlockUrl((data.blockUrl as BlockUrlRuleRaw[]) ?? []),
      options: { ...DEFAULT_OPTIONS, ...(data as any) },
      enable: (data as any).enable ?? true,
      blockUrlWhite: (data as any).blockUrlWhite ?? false,
      initSyncComplete: true,
    };
    set(patch);

    // 设置 sidePanel 行为
    if (!isFirefox) {
      try {
        await chrome.sidePanel.setPanelBehavior({
          openPanelOnActionClick: (data as any).sidePanel ?? false,
        });
      } catch {
        /* sidePanel 可能在 SW 中不可用 */
      }
    }
  },

  loadFromLocal: async () => {
    const area = chrome.storage.session ?? chrome.storage.local;
    const data = await area.get({
      ...DEFAULT_LOCAL_VAR,
    });
    set({
      featMobileTabId: new Set(data.featMobileTabId ?? []),
      featAutoDownTabId: new Set(data.featAutoDownTabId ?? []),
      mediaControl: data.mediaControl ?? DEFAULT_LOCAL_VAR.mediaControl,
      previewShowTitle: data.previewShowTitle ?? false,
      previewDeleteDuplicateFilenames: data.previewDeleteDuplicateFilenames ?? false,
      M3u8HideDownloadedSegments: data.M3u8HideDownloadedSegments ?? true,
      initLocalComplete: true,
    });
  },

  persistOptions: async () => {
    const { Ext, Type, Regex, blockUrl, options } = get();
    const { blockUrl: _drop, ...restOptions } = options;
    void _drop;
    await chrome.storage.sync.set({
      Ext: Array.from(Ext.values()),
      Type: Array.from(Type.values()),
      Regex: Regex.map((r) => ({
        type: r.regex.flags.includes('g')
          ? r.regex.flags.includes('i') ? 'ig' : 'g'
          : r.regex.flags.includes('i') ? 'i' : '',
        regex: r.regex.source,
        ext: r.ext,
        blackList: r.blackList,
        state: r.state,
      })) as RegexRule[],
      blockUrl: blockUrl.map((r) => ({
        url: r.url.source,
        state: r.state,
      })),
      ...restOptions,
    });
  },
}));
