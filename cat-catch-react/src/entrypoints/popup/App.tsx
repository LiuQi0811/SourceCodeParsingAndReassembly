import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Download,
  Trash2,
  Filter,
  Copy,
  Play,
  Pause,
  CheckSquare,
  Search,
  Settings,
  Video,
  MonitorPlay,
  Radio,
  Database,
  Smartphone,
  DownloadCloud,
  GitMerge,
  FlipHorizontal2,
  ListTree,
  FileJson,
  Film,
  Clapperboard,
  Send,
  Terminal,
  Server,
  QrCode,
  ChevronDown,
  ChevronUp,
  PictureInPicture2,
  Maximize,
  Camera,
  Repeat2,
  Volume2,
  VolumeX,
  Gauge,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Slider } from '@components/ui/Slider';
import { cn } from '@lib/utils';
import { byteToSize, filterFileName, getUrlFileName, secToTime } from '@lib/function';
import { useMediaStore, type MediaItem } from '@stores/media';
import { useSettingsStore } from '@stores/settings';
import { sendRuntimeMessage, getCurrentTabId } from '@lib/chrome';
import { i18n } from '@lib/i18n';
import QRCode from 'qrcode';

type Scope = 'current' | 'other' | 'media';

// catch-script 入口配置(对应 background.ts scriptList 条目)
const SCRIPT_ENTRIES = [
  { script: 'recorder.js', key: 'recorder', icon: Video, tip: '视频录制' },
  { script: 'recorder2.js', key: 'recorder2', icon: MonitorPlay, tip: '屏幕捕获' },
  { script: 'webrtc.js', key: 'webrtc', icon: Radio, tip: 'WebRTC 录制' },
] as const;

// 工具脚本(左侧,还原原 popup.html search/catch 按钮 type=script)
const TOOL_SCRIPTS = [
  { script: 'search.js', key: 'search', icon: Search, tip: '深度搜索' },
  { script: 'catch.js', key: 'catch', icon: Database, tip: '缓存捕捉' },
] as const;

// 功能开关(右侧,还原原 popup.html MobileUserAgent/AutoDown 按钮)
const FEATURE_ENTRIES = [
  { message: 'mobileUserAgent', key: 'MobileUserAgent', icon: Smartphone, tip: '模拟手机' },
  { message: 'autoDown', key: 'AutoDown', icon: DownloadCloud, tip: '自动下载' },
] as const;

export default function App() {
  const [scope, setScope] = useState<Scope>('current');
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterExt, setFilterExt] = useState<string>('');
  // 脚本开关状态(还原原 popup.js 启动时 getButtonState)
  const [buttonState, setButtonState] = useState<Record<string, boolean>>({});

  // settings.tabId 用于区分当前/其他 tab(popup 与 background 同步的 tabId)
  const tabId = useSettingsStore((s) => s.tabId);
  const setTabId = useSettingsStore((s) => s.setTabId);
  const saveAs = useSettingsStore((s) => s.options.saveAs);
  // 状态栏:还原原 popup.html 顶部 #Tips/#quantity 显示的"情况"
  // 嗅探开关、模拟手机、自动下载 状态(原 popup.js updateButton/getButtonState)
  const enable = useSettingsStore((s) => s.enable);
  const mobileEnabled = useSettingsStore((s) => s.featMobileTabId.has(tabId));
  const autoDownEnabled = useSettingsStore((s) => s.featAutoDownTabId.has(tabId));
  // popup 自己的 media store 独立于 background,
  // 启动时 loadFromStorage 拉全量 + onMessage popupAddData 增量更新
  const buckets = useMediaStore((s) => s.buckets);
  const clearTab = useMediaStore((s) => s.clearTab);
  const clearOtherTabs = useMediaStore((s) => s.clearOtherTabs);
  const loadFromStorage = useMediaStore((s) => s.loadFromStorage);
  const persist = useMediaStore((s) => s.persist);
  const setSelectedAll = useMediaStore((s) => s.setSelectedAll);

  const refreshButtonState = useCallback(async () => {
    const tid = await getCurrentTabId();
    const res = await sendRuntimeMessage({
      Message: 'getButtonState',
      tabId: tid,
    });
    if (res && typeof res === 'object') setButtonState(res as Record<string, boolean>);
  }, []);
  const toggleScript = useCallback(
    async (script: string) => {
      // 每次点击重新获取当前 tab id,避免 store tabId 时序问题导致 -1
      const tid = await getCurrentTabId();
      if (tid < 0) {
        console.error('[cat-catch] 无法获取当前 tab id');
        return;
      }
      const res = await sendRuntimeMessage<string>({ Message: 'script', script, tabId: tid });
      if (res && res !== 'ok') console.error('[cat-catch] script inject failed:', res);
      await refreshButtonState();
    },
    [refreshButtonState],
  );

  // 功能开关(模拟手机/自动下载,还原原 popup.html MobileUserAgent/AutoDown)
  const toggleFeature = useCallback(
    async (message: string) => {
      const tid = await getCurrentTabId();
      if (tid < 0) {
        console.error('[cat-catch] 无法获取当前 tab id');
        return;
      }
      await sendRuntimeMessage({ Message: message, tabId: tid });
      await refreshButtonState();
    },
    [refreshButtonState],
  );

  // 启动:获取当前 tab + 全量加载 + 通知 background 启动 HeartBeat + 清理冗余 + 拉脚本状态(还原原 popup.js)
  useEffect(() => {
    void (async () => {
      // popup 启动时获取当前活动 tab id(还原原 popup.js 的 G.tabId 设置)
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) setTabId(tab.id);
      void loadFromStorage();
      void sendRuntimeMessage({ Message: 'HeartBeat' });
      void sendRuntimeMessage({ Message: 'clearRedundant' });
      void refreshButtonState();
    })();
  }, [loadFromStorage, refreshButtonState, setTabId]);

  // 按 tabId 切分"当前" / "其他"(还原原 popup.js 的 cacheData[G.tabId] vs 其他)
  const currentTab = useMemo(
    () => buckets.get(tabId) ?? [],
    [buckets, tabId],
  );
  const otherTabs = useMemo(() => {
    const arr: MediaItem[] = [];
    for (const [tid, list] of buckets) {
      if (tid !== tabId) arr.push(...list);
    }
    return arr;
  }, [buckets, tabId]);

  const rawList = scope === 'current' ? currentTab : otherTabs;
  // 扩展名筛选(简单实现)
  const list = useMemo(() => {
    if (!filterExt) return rawList;
    return rawList.filter((m) => (m.ext ?? '').toLowerCase() === filterExt.toLowerCase());
  }, [rawList, filterExt]);

  // 收集所有扩展名供筛选下拉
  const exts = useMemo(() => {
    const set = new Set<string>();
    for (const m of rawList) if (m.ext) set.add(m.ext);
    return Array.from(set).sort();
  }, [rawList]);

  const selectedCount = list.filter((m) => m.selected).length;
  const isAllSelected = list.length > 0 && list.every((m) => m.selected);

  const handleClear = () => {
    if (scope === 'current') {
      clearTab(tabId);
    } else {
      clearOtherTabs(tabId);
    }
    void persist();
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="flex flex-col w-[420px] h-[560px] bg-[var(--color-surface] text-[var(--color-text]">
        {/* 顶部 Tab 切换 */}
        <Tabs.Root
          value={scope}
          onValueChange={(v) => setScope(v as Scope)}
          className="flex flex-col flex-1 min-h-0"
        >
          <Tabs.List className="flex border-b border-[var(--color-border]">
            <Tabs.Trigger
              value="current"
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                'data-[state=active]:text-[var(--color-primary] data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-primary]',
                'hover:bg-[var(--color-surface-dim]',
              )}
            >
              当前页 ({currentTab.length})
            </Tabs.Trigger>
            <Tabs.Trigger
              value="other"
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                'data-[state=active]:text-[var(--color-primary] data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-primary]',
                'hover:bg-[var(--color-surface-dim]',
              )}
            >
              其他页 ({otherTabs.length})
            </Tabs.Trigger>
            <Tabs.Trigger
              value="media"
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                'data-[state=active]:text-[var(--color-primary] data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-primary]',
                'hover:bg-[var(--color-surface-dim]',
              )}
            >
              媒体控制
            </Tabs.Trigger>
          </Tabs.List>

          {/* 工具栏 */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--color-border] bg-[var(--color-surface-dim]">
            {scope !== 'media' && (
              <>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="全选/取消"
                      onClick={() => {
                        setSelectedAll(tabId, !isAllSelected);
                      }}
                    >
                      <CheckSquare className="w-4 h-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                      全选 / 取消全选
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>

                {/* 在线合并(还原原 popup.html mergeDown,跳转 M3U8 解析器合并下载) */}
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="在线合并"
                      disabled={selectedCount === 0}
                      onClick={() => {
                        const items = list.filter((m) => m.selected);
                        for (const it of items) {
                          window.open(
                            chrome.runtime.getURL('m3u8.html') +
                              `?url=${encodeURIComponent(it.url)}`,
                            '_blank',
                          );
                        }
                      }}
                    >
                      <GitMerge className="w-4 h-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                      在线合并({selectedCount})
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="下载选中"
                      onClick={() => {
                        const items = list.filter((m) => m.selected);
                        for (const it of items) {
                          void chrome.downloads.download({
                            url: it.url,
                            filename: filterFileName(it.name) || getUrlFileName(it.url),
                            saveAs,
                          });
                        }
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                      下载选中 ({selectedCount})
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="复制 URL"
                      onClick={() => {
                        const text = list
                          .filter((m) => m.selected)
                          .map((m) => m.url)
                          .join('\n');
                        void navigator.clipboard.writeText(text);
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                      复制选中 URL
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="筛选"
                      onClick={() => setFilterVisible((v) => !v)}
                    >
                      <Filter className="w-4 h-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                      筛选扩展名
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>

                {/* 反选(还原原 popup.html invertSelection) */}
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="反选"
                      onClick={() => useMediaStore.getState().invertSelection(tabId)}
                    >
                      <FlipHorizontal2 className="w-4 h-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                      反选
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </>
            )}

            {/* 深度搜索 / 缓存捕捉(还原原 popup.html search/catch 按钮) */}
            {TOOL_SCRIPTS.map(({ script, key, icon: Icon, tip }) => {
              const active = !!buttonState[key];
              return (
                <Tooltip.Root key={script}>
                  <Tooltip.Trigger asChild>
                    <Button
                      variant={active ? 'primary' : 'ghost'}
                      size="icon"
                      title={tip}
                      onClick={() => void toggleScript(script)}
                    >
                      <Icon className="w-4 h-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                      {tip}{active ? ' (已开启)' : ''}
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            })}

            <div className="flex-1" />

            {/* 录制入口(还原原 popup.html 108-113 行) */}
            {SCRIPT_ENTRIES.map(({ script, key, icon: Icon, tip }) => {
              const active = !!buttonState[key];
              return (
                <Tooltip.Root key={script}>
                  <Tooltip.Trigger asChild>
                    <Button
                      variant={active ? 'primary' : 'ghost'}
                      size="icon"
                      title={tip}
                      onClick={() => void toggleScript(script)}
                    >
                      <Icon className="w-4 h-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                      {tip}{active ? ' (已注入)' : ''}
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            })}

            {/* 模拟手机 / 自动下载(还原原 popup.html MobileUserAgent/AutoDown) */}
            {FEATURE_ENTRIES.map(({ message, key, icon: Icon, tip }) => {
              const active = !!buttonState[key];
              return (
                <Tooltip.Root key={key}>
                  <Tooltip.Trigger asChild>
                    <Button
                      variant={active ? 'primary' : 'ghost'}
                      size="icon"
                      title={tip}
                      onClick={() => void toggleFeature(message)}
                    >
                      <Icon className="w-4 h-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                      {tip}{active ? ' (已开启)' : ''}
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            })}

            {/* 工具页入口(还原原 popup.html 第 83-87 行 M3U8/MPD/JSON/FFmpeg) */}
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="ghost" size="icon" title="M3U8 解析器" onClick={() => window.open(chrome.runtime.getURL('m3u8.html'), '_blank')}>
                  <ListTree className="w-4 h-4" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">M3U8 解析器</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="ghost" size="icon" title="MPD 解析器" onClick={() => window.open(chrome.runtime.getURL('mpd.html'), '_blank')}>
                  <Film className="w-4 h-4" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">MPD 解析器</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="ghost" size="icon" title="JSON 格式化" onClick={() => window.open(chrome.runtime.getURL('json.html'), '_blank')}>
                  <FileJson className="w-4 h-4" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">JSON 格式化</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="ghost" size="icon" title="FFmpeg" onClick={() => window.open(chrome.runtime.getURL('ffmpeg.html'), '_blank')}>
                  <Clapperboard className="w-4 h-4" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">FFmpeg</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>

            {scope !== 'media' && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="清空"
                    onClick={handleClear}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                    清空列表
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="设置"
                  onClick={() => chrome.runtime.openOptionsPage()}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                  打开设置
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>

          {/* 扩展名筛选条(仅列表页显示) */}
          {scope !== 'media' && filterVisible && (
            <div className="flex items-center gap-2 px-2 py-1 border-b border-[var(--color-border] bg-[var(--color-surface] text-xs">
              <span className="text-[var(--color-text-muted]">扩展名:</span>
              <select
                value={filterExt}
                onChange={(e) => setFilterExt(e.target.value)}
                className="flex-1 bg-[var(--color-surface-dim] border border-[var(--color-border] rounded px-1 py-0.5"
              >
                <option value="">全部</option>
                {exts.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              {filterExt && (
                <button
                  onClick={() => setFilterExt('')}
                  className="text-[var(--color-primary]"
                >
                  清除
                </button>
              )}
            </div>
          )}

          {/* 媒体列表 / 媒体控制页 */}
          <Tabs.Content
            value={scope}
            className="flex-1 overflow-auto min-h-0"
          >
            {scope === 'media' ? (
              <MediaControlPanel />
            ) : list.length === 0 ? (
              <EmptyState tabId={tabId} />
            ) : (
              <ul className="divide-y divide-[var(--color-border]">
                {list.map((item) => (
                  <MediaItemRow key={item.requestId} item={item} />
                ))}
              </ul>
            )}
          </Tabs.Content>
        </Tabs.Root>

        {/* 底部状态栏 —— 还原原 popup.html 顶部"情况"显示 */}
        <div className="flex items-center gap-2 px-2 py-1 border-t border-[var(--color-border] text-xs text-[var(--color-text-muted] bg-[var(--color-surface-dim]">
          <span title="当前活动 tab id">
            tabId: <span className="font-mono text-[var(--color-text]">{tabId}</span>
          </span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded',
              enable
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : 'bg-red-500/15 text-red-600 dark:text-red-400',
            )}
            title={enable ? '嗅探中' : '已暂停'}
          >
            {enable ? '嗅探中' : '已暂停'}
          </span>
          {mobileEnabled && (
            <span
              className="px-1.5 py-0.5 rounded bg-[var(--color-primary]/15 text-[var(--color-primary]"
              title="模拟手机已开启"
            >
              手机
            </span>
          )}
          {autoDownEnabled && (
            <span
              className="px-1.5 py-0.5 rounded bg-[var(--color-primary]/15 text-[var(--color-primary]"
              title="自动下载已开启"
            >
              自动下载
            </span>
          )}
          <div className="flex-1" />
          <span title="当前 tab 媒体数 / 其他 tab 媒体数">
            当前 {currentTab.length} · 其他 {otherTabs.length}
          </span>
          <span title="列表中显示的条数">
            共 {list.length} 条{filterExt ? ' · 已筛选' : ''}
          </span>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

// 发送到 MQTT(popup 端用 mqtt.min.js 直连,SW 不支持 WebSocket)
async function sendToMQTT(item: MediaItem) {
  const s = useSettingsStore.getState();
  if (!s.options.mqttEnable) return;
  const lib = (window as unknown as { mqtt?: { connect: (url: string, opts: Record<string, unknown>) => MQTTClient } }).mqtt;
  if (!lib?.connect) {
    console.warn('[cat-catch] MQTT 库未加载(lib/mqtt.min.js)');
    return;
  }
  const protocol = s.options.mqttProtocol || 'wss';
  const broker = s.options.mqttBroker;
  const port = s.options.mqttPort || 8084;
  const path = s.options.mqttPath || '/mqtt';
  if (!broker) {
    console.warn('[cat-catch] MQTT broker 未配置');
    return;
  }
  const mqttUrl = `${protocol}://${broker}:${port}${path}`;
  const clientId = `${s.options.mqttClientId || 'cat-catch-client'}-${Math.random().toString(16).slice(2)}`;
  const opts: Record<string, unknown> = { clientId, clean: true, connectTimeout: 10000, reconnectPeriod: 0 };
  if (s.options.mqttUser) opts.username = s.options.mqttUser;
  if (s.options.mqttPassword) opts.password = s.options.mqttPassword;
  try {
    const client = lib.connect(mqttUrl, opts);
    client.on('connect', () => {
      const topic = s.options.mqttTopic || 'cat-catch/media';
      const titleLen = s.options.mqttTitleLength || 100;
      const payload = JSON.stringify({
        title: (item.title || '').slice(0, titleLen),
        url: item.url,
        mime: item.mime,
        action: 'media_found',
      });
      client.publish(topic, payload, { qos: s.options.mqttQos || 0 }, () => {
        client.end();
      });
    });
    client.on('error', (err: unknown) => {
      console.error('[cat-catch] MQTT error:', err);
      client.end();
    });
  } catch (e) {
    console.error('[cat-catch] MQTT connect failed:', e);
  }
}

interface MQTTClient {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  publish: (topic: string, payload: string, opts: Record<string, unknown>, cb: () => void) => void;
  end: () => void;
}

function MediaItemRow({ item }: { item: MediaItem }) {
  const toggleSelected = useMediaStore((s) => s.toggleSelected);
  const saveAs = useSettingsStore((s) => s.options.saveAs);
  // 逐项操作开关(还原原 popup.html 行内 aria2/invoke/send2local/mqtt 图标,
  // 现统一移到详情面板内,行内只保留 复选框/预览/下载/展开箭头)
  const enableAria2Rpc = useSettingsStore((s) => s.options.enableAria2Rpc);
  const invokeEnabled = useSettingsStore((s) => s.options.invoke);
  const send2localVisible = useSettingsStore(
    (s) => s.options.send2localManual || s.options.send2local,
  );
  const mqttEnable = useSettingsStore((s) => s.options.mqttEnable);
  // 详情面板展开/折叠状态(还原原 popup.js data.urlPanelShow)
  const [expanded, setExpanded] = useState(false);
  // 二维码展开状态(点击生成,再点击关闭)
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  const fileName = filterFileName(item.name) || getUrlFileName(item.url);

  const handleQrcode = async () => {
    if (qrSrc) {
      setQrSrc(null);
      return;
    }
    try {
      // 本地生成二维码 data URL,避免依赖外部 API(CSP 限制 + 网络问题)
      const margin = item.url.length >= 200 ? 2 : 1;
      const dataUrl = await QRCode.toDataURL(item.url, {
        width: 256,
        margin,
        errorCorrectionLevel: 'M',
      });
      setQrSrc(dataUrl);
    } catch (e) {
      console.error('[cat-catch] QR code generate failed:', e);
    }
  };

  // 携带请求头下载(还原原 popup.js catDownload,发 catDown 消息给 background)
  const handleCatDown = () => {
    void sendRuntimeMessage({
      Message: 'catDown',
      data: { ...item, downFileName: fileName },
    });
  };

  // 发送到在线 FFmpeg(还原原 popup.js catDownFFmpeg,发 catCatchFFmpeg 消息)
  const handleFFmpeg = () => {
    void sendRuntimeMessage({
      Message: 'catCatchFFmpeg',
      use: 'addFile',
      files: [{ data: item.url, name: fileName }],
      title: item.title ?? '',
      tabId: item.tabId,
    });
  };

  // 是否是可预览的视频/图片(用于详情面板内显示预览)
  const isPlayable = /^(video|audio|image)\//.test(item.type ?? '') ||
    ['mp4', 'webm', 'ogg', 'mp3', 'wav', 'm4a', 'mov', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
      .includes((item.ext ?? '').toLowerCase());

  return (
    <li className="border-b border-[var(--color-border] last:border-b-0">
      <div
        className="flex items-start gap-2 px-2 py-1.5 hover:bg-[var(--color-surface-dim] cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <input
          type="checkbox"
          checked={!!item.selected}
          onChange={(e) => {
            e.stopPropagation();
            toggleSelected(item.tabId, item.requestId);
          }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 w-3.5 h-3.5 accent-[var(--color-primary]"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate" title={item.name || item.url}>
            {item.name || item.url}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted]">
            <span className="uppercase">{item.ext || '?'}</span>
            {item.size ? <span>{byteToSize(item.size)}</span> : null}
            {item.type ? <span className="truncate">{item.type}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            title={i18n('preview')}
            onClick={() =>
              window.open(
                chrome.runtime.getURL('preview.html') +
                  `?tabId=${item.tabId}&url=${encodeURIComponent(item.url)}`,
                '_blank',
              )
            }
          >
            <Play className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="primary"
            size="icon"
            title={i18n('download')}
            onClick={() => {
              void chrome.downloads.download({
                url: item.url,
                filename: fileName,
                saveAs,
              });
            }}
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={expanded ? '收起详情' : '展开详情'}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* 详情面板(还原原 popup.js .url 面板) */}
      {expanded && (
        <div className="px-3 pb-2 pt-1 bg-[var(--color-surface-dim]/40 text-xs space-y-2">
          {/* 基本信息 */}
          <div className="space-y-0.5">
            {item.title ? (
              <div>
                <b className="text-[var(--color-text-muted]">{i18n('preview')}: </b>
                <span className="break-all">{item.title}</span>
              </div>
            ) : null}
            {item.type ? (
              <div>
                <b className="text-[var(--color-text-muted]">MIME: </b>
                <span className="break-all">{item.type}</span>
              </div>
            ) : null}
            {item.size ? (
              <div>
                <b className="text-[var(--color-text-muted]">大小: </b>
                <span>{byteToSize(item.size)}</span>
              </div>
            ) : null}
            {item.requestHeaders && Object.keys(item.requestHeaders).length > 0 ? (
              <div>
                <b className="text-[var(--color-text-muted]">请求头:</b>
                <pre className="mt-0.5 whitespace-pre-wrap break-all bg-[var(--color-surface] rounded p-1.5 text-[10px] leading-tight">
                  {JSON.stringify(item.requestHeaders, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>

          {/* 完整 URL(可选中复制) */}
          <div>
            <b className="text-[var(--color-text-muted]">URL: </b>
            <textarea
              readOnly
              value={item.url}
              className="mt-0.5 w-full h-12 px-1.5 py-1 bg-[var(--color-surface] border border-[var(--color-border] rounded text-[10px] resize-none focus:outline-none focus:border-[var(--color-primary]"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </div>

          {/* 额外按钮(还原原 popup.js .moreButton) */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* 二维码 */}
            <Button
              variant="ghost"
              size="sm"
              title="二维码"
              onClick={handleQrcode}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="ml-1">二维码</span>
            </Button>
            {/* 携带请求头下载(catDown) */}
            <Button
              variant="ghost"
              size="sm"
              title={i18n('downloadWithRequestHeader')}
              onClick={handleCatDown}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="ml-1">携带请求头下载</span>
            </Button>
            {/* 发送到在线 FFmpeg */}
            <Button
              variant="ghost"
              size="sm"
              title={i18n('sendFfmpeg')}
              onClick={handleFFmpeg}
            >
              <Clapperboard className="w-3.5 h-3.5" />
              <span className="ml-1">FFmpeg</span>
            </Button>
            {/* 调用(invoke) */}
            {invokeEnabled ? (
              <Button
                variant="ghost"
                size="sm"
                title={i18n('invoke')}
                onClick={() => void sendRuntimeMessage({ Message: 'invoke', data: item, tabId: item.tabId })}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span className="ml-1">{i18n('invoke')}</span>
              </Button>
            ) : null}
            {/* Aria2 */}
            {enableAria2Rpc ? (
              <Button
                variant="ghost"
                size="sm"
                title="Aria2"
                onClick={() => void sendRuntimeMessage({ Message: 'aria2', data: item })}
              >
                <Send className="w-3.5 h-3.5" />
                <span className="ml-1">Aria2</span>
              </Button>
            ) : null}
            {/* send2local */}
            {send2localVisible ? (
              <Button
                variant="ghost"
                size="sm"
                title={i18n('send2local')}
                onClick={() =>
                  void sendRuntimeMessage({
                    Message: 'send2local',
                    action: 'catch',
                    data: item,
                    tabId: item.tabId,
                  })
                }
              >
                <Server className="w-3.5 h-3.5" />
                <span className="ml-1">{i18n('send2local')}</span>
              </Button>
            ) : null}
            {/* MQTT */}
            {mqttEnable ? (
              <Button
                variant="ghost"
                size="sm"
                title={i18n('send2MQTT')}
                onClick={() => void sendToMQTT(item)}
              >
                <Radio className="w-3.5 h-3.5" />
                <span className="ml-1">MQTT</span>
              </Button>
            ) : null}
          </div>

          {/* 二维码图片 */}
          {qrSrc && (
            <div className="flex flex-col items-center gap-1 py-2">
              <img
                src={qrSrc}
                alt="QR Code"
                className="max-w-[200px] max-h-[200px] rounded border border-[var(--color-border]"
              />
              <button
                className="text-[10px] text-[var(--color-text-muted] underline"
                onClick={() => setQrSrc(null)}
              >
                关闭二维码
              </button>
            </div>
          )}

          {/* 视频/图片预览 */}
          {isPlayable && /^(image)\//.test(item.type ?? '') && (
            <div className="py-1">
              <img
                src={item.url}
                alt={item.name ?? 'preview'}
                className="max-w-full max-h-48 rounded border border-[var(--color-border] mx-auto"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            </div>
          )}
          {isPlayable && /^(video|audio)\//.test(item.type ?? '') && (
            <div className="py-1">
              <video
                src={item.url}
                controls
                className="max-w-full max-h-48 rounded border border-[var(--color-border] mx-auto"
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function EmptyState({ tabId }: { tabId: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted] gap-3">
      <Search className="w-10 h-10 opacity-40" />
      <p className="text-sm">未捕获到媒体资源</p>
      <p className="text-xs">当前 tabId: {tabId}</p>
    </div>
  );
}

// ===== 媒体控制页(还原原 popup.html #otherOptions + js/media-control.js) =====
interface VideoTab {
  id: number;
  title: string;
  favIconUrl?: string;
}
interface VideoState {
  time: number; // 进度百分比 0-100
  currentTime: number;
  duration: number;
  volume: number; // 0-1
  count: number;
  src: string[];
  paused: boolean;
  loop: boolean;
  speed: number;
  muted: boolean;
  type: string;
  videoStatus: number[];
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

function MediaControlPanel() {
  // 选中的"页面"(tab)与"媒体索引",还原原 media-control.js _tabId/_index
  const [activeTabId, setActiveTabId] = useState<number>(-1);
  const [index, setIndex] = useState(0);
  const [videoTabs, setVideoTabs] = useState<VideoTab[]>([]);
  const [state, setState] = useState<VideoState | null>(null);
  const [seeking, setSeeking] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(2);

  // 1) 加载"选择页面"下拉(还原 media-control.js updateVideoTagOptions)
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = (await sendRuntimeMessage<VideoTab[]>({ Message: 'getVideoTabs' })) ?? [];
        if (!active) return;
        setVideoTabs(res);
        // 未选中且列表非空,默认选第一个有 video 的 tab
        if (activeTabId === -1 && res.length > 0 && res[0]) {
          setActiveTabId(res[0].id);
        }
      } catch {
        /* background 不可用,跳过 */
      }
    };
    void load();
    // 还原原项目 setInterval(updateVideoTagOptions, 1000)
    const timer = window.setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activeTabId]);

  // 2) 轮询视频状态(还原 media-control.js setVideoStateTimer 500ms)
  useEffect(() => {
    if (activeTabId <= 0) return;
    let active = true;
    const poll = async () => {
      try {
        // 用 webNavigation.getAllFrames 遍历所有 frame(视频可能在 iframe 内)
        const frames = await chrome.webNavigation.getAllFrames({ tabId: activeTabId });
        if (frames) {
          for (const f of frames) {
            try {
              const res = (await chrome.tabs.sendMessage(
                activeTabId,
                { Message: 'getVideoState', index },
                { frameId: f.frameId },
              )) as VideoState | undefined;
              if (res && res.count > 0) {
                if (active) {
                  setState(res);
                  if (res.speed && res.speed !== 1) setPlaybackRate(res.speed);
                }
                return; // 找到有视频的 frame,停止遍历
              }
            } catch {
              /* frame 无 content script / 跨域,跳过 */
            }
          }
        }
      } catch {
        /* webNavigation 不可用,回退到主 frame */
        try {
          const res = (await chrome.tabs.sendMessage(activeTabId, {
            Message: 'getVideoState',
            index,
          })) as VideoState | undefined;
          if (active && res && res.count > 0) {
            setState(res);
            if (res.speed && res.speed !== 1) setPlaybackRate(res.speed);
          }
        } catch {
          /* tab 无 content script / 已关闭 */
        }
      }
    };
    void poll();
    const timer = window.setInterval(poll, 500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activeTabId, index]);

  // 3) 控制指令(直接给页面 content script 发消息)
  const sendRemote = useCallback(
    (msg: Record<string, unknown>) =>
      void chrome.tabs.sendMessage(activeTabId, { ...msg, index }),
    [activeTabId, index],
  );

  const togglePlay = useCallback(() => sendRemote({ Message: 'play' }), [sendRemote]);
  const toggleMuted = useCallback(() => sendRemote({ Message: 'muted' }), [sendRemote]);
  const toggleLoop = useCallback(() => sendRemote({ Message: 'loop' }), [sendRemote]);
  const togglePiP = useCallback(() => sendRemote({ Message: 'pip' }), [sendRemote]);
  const toggleFullscreen = useCallback(() => {
    // 还原原 media-control.js:全屏时先切到目标 tab
    chrome.tabs.get(activeTabId, (tab) => {
      if (chrome.runtime.lastError || !tab.index) {
        sendRemote({ Message: 'fullScreen' });
        return;
      }
      chrome.tabs.highlight({ tabs: tab.index }, () => {
        sendRemote({ Message: 'fullScreen' });
        window.close();
      });
    });
  }, [activeTabId, sendRemote]);
  const screenshot = useCallback(() => sendRemote({ Message: 'screenshot' }), [sendRemote]);
  const seek = useCallback(
    (pct: number) => sendRemote({ Message: 'seek', time: pct }),
    [sendRemote],
  );
  const setVolume = useCallback(
    (vol: number) => sendRemote({ Message: 'volume', volume: vol }),
    [sendRemote],
  );
  const setSpeed = useCallback(
    (speed: number) => {
      setPlaybackRate(speed);
      sendRemote({ Message: 'speed', speed });
    },
    [sendRemote],
  );

  // 没有可操控媒体的网页
  if (activeTabId === -1 || !state) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted] gap-3 p-4">
        <MonitorPlay className="w-10 h-10 opacity-40" />
        <p className="text-sm">{i18n('noMediaDetected')}</p>
        <p className="text-xs">{i18n('noControllableMediaDetected')}</p>
      </div>
    );
  }

  const isAudio = state.type === 'audio';
  const fmtTime = (s: number) => {
    if (!isFinite(s)) return '00:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  const truncateSrc = (src: string) => {
    const name = src.split('/').pop() ?? src;
    if (name.length >= 40) return name.slice(0, 18) + '...' + name.slice(-18);
    return name;
  };

  return (
    <div className="flex flex-col h-full p-3 gap-3 text-xs">
      {/* 选择页面 + 选择媒体(还原原 popup.html #videoTabIndex / #videoIndex) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <b className="nowrap text-[var(--color-text-muted] shrink-0">{i18n('selectWebpage')}</b>
          <select
            value={activeTabId}
            onChange={(e) => {
              setActiveTabId(Number(e.target.value));
              setIndex(0);
              setState(null);
            }}
            className="flex-1 min-w-0 bg-[var(--color-surface-dim] border border-[var(--color-border] rounded px-1.5 py-1 text-xs focus:outline-none focus:border-[var(--color-primary]"
            title={i18n('selectWebpage')}
          >
            {videoTabs.length === 0 ? (
              <option value={-1}>{i18n('noMediaDetected')}</option>
            ) : (
              videoTabs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || `Tab ${t.id}`}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <b className="nowrap text-[var(--color-text-muted] shrink-0">{i18n('selectMedia')}</b>
          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="flex-1 min-w-0 bg-[var(--color-surface-dim] border border-[var(--color-border] rounded px-1.5 py-1 text-xs focus:outline-none focus:border-[var(--color-primary]"
            title={i18n('selectMedia')}
          >
            {Array.from({ length: state.count }, (_, i) => (
              <option key={i} value={i}>
                {state.videoStatus?.[i] === 0 ? '▶ ' : ''}{truncateSrc(state.src[i] ?? '')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-px bg-[var(--color-border]" />

      {/* 播放控制(还原原 popup.html #PlayControl) */}
      <div className="space-y-2">
        {/* 倍速 + 播放/暂停 */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[var(--color-text-muted] shrink-0">{i18n('multiplier')}</span>
          <select
            value={playbackRate}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-[var(--color-surface-dim] border border-[var(--color-border] rounded px-1 py-0.5 text-xs focus:outline-none focus:border-[var(--color-primary]"
            title={i18n('speedPlayback')}
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
          <Button
            variant={state.speed !== 1 ? 'primary' : 'ghost'}
            size="sm"
            title={state.speed === 1 ? i18n('speedPlayback') : i18n('normalPlay')}
            onClick={() => setSpeed(state.speed === 1 ? playbackRate : 1)}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span className="ml-1">{state.speed === 1 ? i18n('speedPlayback') : i18n('normalPlay')}</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            title={state.paused ? i18n('play') : i18n('pause')}
            onClick={togglePlay}
          >
            {state.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span className="ml-1">{state.paused ? i18n('play') : i18n('pause')}</span>
          </Button>
        </div>

        {/* 画中画 / 全屏 / 截图 / 循环 / 静音 */}
        <div className="flex items-center gap-1 flex-wrap">
          {!isAudio && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="ghost" size="icon" title={i18n('pictureInPicture')} onClick={togglePiP}>
                  <PictureInPicture2 className="w-3.5 h-3.5" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                  {i18n('pictureInPicture')}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
          {!isAudio && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="ghost" size="icon" title={i18n('fullscreen')} onClick={toggleFullscreen}>
                  <Maximize className="w-3.5 h-3.5" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                  {i18n('fullscreen')}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
          {!isAudio && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="ghost" size="icon" title={i18n('screenshot')} onClick={screenshot}>
                  <Camera className="w-3.5 h-3.5" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="rounded bg-black/90 text-white px-2 py-1 text-xs z-50">
                  {i18n('screenshot')}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
          <Button
            variant={state.loop ? 'primary' : 'ghost'}
            size="icon"
            title={i18n('loop')}
            onClick={toggleLoop}
          >
            <Repeat2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant={state.muted ? 'primary' : 'ghost'}
            size="icon"
            title={i18n('mute')}
            onClick={toggleMuted}
          >
            {state.muted || state.volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </Button>
          {/* 音量 */}
          <Slider
            value={[state.muted ? 0 : state.volume * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => setVolume((v[0] ?? 0) / 100)}
            className="flex-1 min-w-[60px]"
          />
        </div>

        {/* 进度条(还原原 popup.html #time + #timeShow) */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[var(--color-text-muted] w-12 text-right shrink-0">
            {fmtTime(state.currentTime)}
          </span>
          <Slider
            value={[seeking ? dragTime : state.time]}
            min={0}
            max={100}
            step={0.1}
            onValueChange={(v) => setDragTime(v[0] ?? 0)}
            onValueCommit={(v) => {
              setSeeking(false);
              seek(v[0] ?? 0);
            }}
            onPointerDown={() => setSeeking(true)}
            className="flex-1"
          />
          <span className="font-mono text-[var(--color-text-muted] w-12 shrink-0">
            {fmtTime(state.duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
