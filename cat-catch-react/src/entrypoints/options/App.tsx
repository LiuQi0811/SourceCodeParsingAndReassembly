import { useEffect, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import {
  FileVideo,
  Sliders,
  Search,
  Send,
  ListTree,
  Info,
  Server,
  Terminal,
  Type as TypeIcon,
  Shield,
  Tag,
  Download,
  Code,
  Radio,
  Wrench,
  Copy as CopyIcon,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { cn } from '@lib/utils';
import { useSettingsStore } from '@stores/settings';
import { getExtensionVersion, i18n } from '@lib/i18n';
import {
  DEFAULT_EXT_RULES,
  DEFAULT_TYPE_RULES,
  DEFAULT_REGEX_RULES,
  DEFAULT_OPTIONS,
  type TypeRule,
  type ExtRule,
  type RegexRule,
  type BlockUrlRuleRaw,
} from '@lib/config';

const SECTIONS = [
  { value: 'general', label: '通用', icon: Sliders },
  { value: 'filter', label: '过滤', icon: FileVideo },
  { value: 'type', label: '类型', icon: TypeIcon },
  { value: 'regex', label: '正则', icon: Search },
  { value: 'blockUrl', label: '屏蔽', icon: Shield },
  { value: 'script', label: '脚本', icon: Wrench },
  { value: 'copy', label: '复制', icon: CopyIcon },
  { value: 'm3u8', label: 'M3U8', icon: ListTree },
  { value: 'aria2', label: 'Aria2', icon: Send },
  { value: 'send2local', label: '本地', icon: Server },
  { value: 'invoke', label: '远程', icon: Terminal },
  { value: 'replaceTags', label: '标签', icon: Tag },
  { value: 'downloader', label: '下载器', icon: Download },
  { value: 'customCss', label: 'CSS', icon: Code },
  { value: 'mqtt', label: 'MQTT', icon: Radio },
  { value: 'operation', label: '操作', icon: Wrench },
  { value: 'about', label: '关于', icon: Info },
] as const;

export default function App() {
  const settings = useSettingsStore();
  const [tab, setTab] = useState<(typeof SECTIONS)[number]['value']>('general');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('cat-catch-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  // 启动时加载配置(还原原 options.js 的 init)
  useEffect(() => {
    void settings.loadFromSync();
    void settings.loadFromLocal();
  }, [settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('cat-catch-theme', theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-[var(--color-surface-dim] text-[var(--color-text]">
      <header className="border-b border-[var(--color-border] bg-[var(--color-surface] px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">猫抓 设置</h1>
          <p className="text-xs text-[var(--color-text-muted] mt-0.5">
            v{getExtensionVersion()}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀️ 亮色' : '🌙 暗色'}
        </Button>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs.Root
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          orientation="vertical"
          className="flex gap-4"
        >
          <Tabs.List className="flex flex-col w-44 shrink-0 gap-1">
            {SECTIONS.map(({ value, label, icon: Icon }) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-[--radius-md] text-sm text-left transition-colors',
                  'data-[state=active]:bg-[var(--color-primary] data-[state=active]:text-white',
                  'hover:bg-[var(--color-surface-dim]',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <div className="flex-1 min-w-0 bg-[var(--color-surface] rounded-[--radius-lg] border border-[var(--color-border] p-4">
            <Tabs.Content value="general">
              <GeneralSection />
            </Tabs.Content>
            <Tabs.Content value="filter">
              <FilterSection />
            </Tabs.Content>
            <Tabs.Content value="type">
              <TypeSection />
            </Tabs.Content>
            <Tabs.Content value="regex">
              <RegexSection />
            </Tabs.Content>
            <Tabs.Content value="blockUrl">
              <BlockUrlSection />
            </Tabs.Content>
            <Tabs.Content value="script">
              <ScriptSection />
            </Tabs.Content>
            <Tabs.Content value="copy">
              <CopySection />
            </Tabs.Content>
            <Tabs.Content value="m3u8">
              <M3u8Section />
            </Tabs.Content>
            <Tabs.Content value="aria2">
              <Aria2Section />
            </Tabs.Content>
            <Tabs.Content value="send2local">
              <Send2LocalSection />
            </Tabs.Content>
            <Tabs.Content value="invoke">
              <InvokeSection />
            </Tabs.Content>
            <Tabs.Content value="replaceTags">
              <ReplaceTagsSection />
            </Tabs.Content>
            <Tabs.Content value="downloader">
              <DownloaderSection />
            </Tabs.Content>
            <Tabs.Content value="customCss">
              <CustomCssSection />
            </Tabs.Content>
            <Tabs.Content value="mqtt">
              <MqttSection />
            </Tabs.Content>
            <Tabs.Content value="operation">
              <OperationSection />
            </Tabs.Content>
            <Tabs.Content value="about">
              <AboutSection />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>
    </div>
  );
}

function GeneralSection() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">通用设置</h2>
      <SettingRow label="启用嗅探" desc="关闭后不再捕获任何媒体">
        <input
          type="checkbox"
          checked={!!options.enable}
          onChange={(e) => {
            update({ enable: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="显示网站图标" desc="列表中显示源站点 favicon">
        <input
          type="checkbox"
          checked={!!options.ShowWebIco}
          onChange={(e) => {
            update({ ShowWebIco: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="角标显示数量" desc="扩展图标上显示已捕获数量">
        <input
          type="checkbox"
          checked={!!options.badgeNumber}
          onChange={(e) => {
            update({ badgeNumber: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="深度搜索" desc="注入 search.js 深度扫描页面">
        <input
          type="checkbox"
          checked={!!options.deepSearch}
          onChange={(e) => {
            update({ deepSearch: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="侧边栏模式" desc="使用 sidePanel 替代 popup">
        <input
          type="checkbox"
          checked={!!options.sidePanel}
          onChange={(e) => {
            update({ sidePanel: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="URL 查重" desc="同一 tab 内 URL 去重">
        <input
          type="checkbox"
          checked={!!options.checkDuplicates}
          onChange={(e) => {
            update({ checkDuplicates: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="使用网页标题作为文件名" desc="开启后,下载文件名使用网页标题">
        <input
          type="checkbox"
          checked={!!options.TitleName}
          onChange={(e) => {
            update({ TitleName: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="始终不启用猫抓下载器" desc="启用 Chrome 内置下载">
        <input
          type="checkbox"
          checked={!!options.catDownload}
          onChange={(e) => {
            update({ catDownload: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="下载完另存为" desc="下载完成时弹窗选择保存目录">
        <input
          type="checkbox"
          checked={!!options.saveAs}
          onChange={(e) => {
            update({ saveAs: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="自动清理模式" desc="0=关闭 / 1=导航时 / 2=刷新时">
        <select
          value={options.autoClearMode}
          className="w-24 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ autoClearMode: Number(e.target.value) as 0 | 1 | 2 });
            void persist();
          }}
        >
          <option value={0}>关闭</option>
          <option value={1}>导航时</option>
          <option value={2}>刷新时</option>
        </select>
      </SettingRow>
      <SettingRow label="最大记录数" desc="单 tab 内最大缓存数量">
        <input
          type="number"
          min={100}
          step={100}
          value={options.maxLength}
          className="w-24 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ maxLength: Number(e.target.value) });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="在线服务地址" desc="ffmpeg / StreamSaver 镜像选择">
        <select
          value={options.onlineServiceAddress}
          className="w-32 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ onlineServiceAddress: Number(e.target.value) as 0 | 1 });
            void persist();
          }}
        >
          <option value={0}>bmmmd.com</option>
          <option value={1}>94cat.com</option>
        </select>
      </SettingRow>
      <SettingRow label="默认播放倍率" desc="预览视频时的默认倍率">
        <input
          type="number"
          min={0.5}
          max={16}
          step={0.5}
          value={options.playbackRate ?? 2}
          className="w-20 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ playbackRate: Number(e.target.value) });
            void persist();
          }}
        />
      </SettingRow>
    </div>
  );
}

function FilterSection() {
  const Ext = useSettingsStore((s) => s.Ext);
  const setExtRules = useSettingsStore((s) => s.setExtRules);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">扩展名过滤</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        勾选需要捕获的扩展名,设置最小体积阈值(KB,0 表示不限)。
      </p>
      <div className="space-y-1.5">
        {Array.from(Ext.values()).map((rule, idx) => (
          <div
            key={rule.ext}
            className="flex items-center gap-2 px-2 py-1 rounded-[--radius-sm] hover:bg-[var(--color-surface-dim]"
          >
            <input
              type="checkbox"
              checked={rule.state}
              onChange={() => {
                const next = Array.from(Ext.values());
                next[idx] = { ...rule, state: !rule.state };
                setExtRules(next);
                void persist();
              }}
            />
            <span className="text-sm uppercase font-mono w-16">{rule.ext}</span>
            <input
              type="number"
              min={0}
              step={10}
              value={rule.size}
              className="w-20 px-2 py-0.5 text-xs border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
              onChange={(e) => {
                const next = Array.from(Ext.values());
                next[idx] = { ...rule, size: Number(e.target.value) };
                setExtRules(next);
                void persist();
              }}
            />
            <span className="text-xs text-[var(--color-text-muted]">KB</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeSection() {
  const Type = useSettingsStore((s) => s.Type);
  const setTypeRules = useSettingsStore((s) => s.setTypeRules);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">MIME 类型过滤</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        按 Content-Type 捕获资源,可设置最小体积阈值(KB)。
      </p>
      <div className="space-y-1.5">
        {Array.from(Type.values()).map((rule, idx) => (
          <div
            key={rule.type}
            className="flex items-center gap-2 px-2 py-1 rounded-[--radius-sm] hover:bg-[var(--color-surface-dim]"
          >
            <input
              type="checkbox"
              checked={rule.state}
              onChange={() => {
                const next = Array.from(Type.values()) as TypeRule[];
                next[idx] = { ...rule, state: !rule.state };
                setTypeRules(next);
                void persist();
              }}
            />
            <span className="text-xs font-mono flex-1 truncate">{rule.type}</span>
            <input
              type="number"
              min={0}
              step={10}
              value={rule.size}
              className="w-20 px-2 py-0.5 text-xs border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
              onChange={(e) => {
                const next = Array.from(Type.values()) as TypeRule[];
                next[idx] = { ...rule, size: Number(e.target.value) };
                setTypeRules(next);
                void persist();
              }}
            />
            <span className="text-xs text-[var(--color-text-muted]">KB</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegexSection() {
  const Regex = useSettingsStore((s) => s.Regex);
  const setRegexRules = useSettingsStore((s) => s.setRegexRules);
  const persist = useSettingsStore((s) => s.persistOptions);

  /** CompiledRegexRule -> RegexRule(把 RegExp.source + flags 还原为字符串) */
  const toRaw = (r: typeof Regex[number]): RegexRule => {
    const flags = r.regex.flags;
    const type = (
      flags.includes('g') && flags.includes('i') ? 'ig'
      : flags.includes('g') ? 'g'
      : flags.includes('i') ? 'i'
      : ''
    ) as RegexRule['type'];
    return { type, regex: r.regex.source, ext: r.ext, blackList: r.blackList, state: r.state };
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">正则匹配</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        通过正则匹配 URL,识别非标准扩展名的媒体资源。点击下方"添加正则"新建规则。
      </p>
      <div className="space-y-2">
        {Regex.map((rule, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 px-2 py-1.5 rounded-[--radius-sm] bg-[var(--color-surface-dim]"
          >
            <input
              type="checkbox"
              checked={rule.state}
              onChange={() => {
                const next = Regex.map((r, i) =>
                  i === idx ? { ...r, state: !r.state } : r,
                );
                setRegexRules(next.map(toRaw));
                void persist();
              }}
            />
            <input
              type="checkbox"
              checked={rule.blackList}
              title="黑名单(匹配后丢弃)"
              onChange={() => {
                const next = Regex.map((r, i) =>
                  i === idx ? { ...r, blackList: !r.blackList } : r,
                );
                setRegexRules(next.map(toRaw));
                void persist();
              }}
            />
            <code className="text-xs flex-1 truncate font-mono" title={rule.regex.source}>
              {rule.regex.source}
            </code>
            <input
              type="text"
              value={rule.ext ?? ''}
              placeholder="ext"
              className="w-16 px-2 py-0.5 text-xs border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
              onChange={(e) => {
                const next = Regex.map((r, i) =>
                  i === idx ? { ...r, ext: e.target.value } : r,
                );
                setRegexRules(next.map(toRaw));
                void persist();
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              title="删除"
              onClick={() => {
                const next = Regex.filter((_, i) => i !== idx);
                setRegexRules(next.map(toRaw));
                void persist();
              }}
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setRegexRules([
            ...Regex.map(toRaw),
            { type: 'ig', regex: 'example\\.com', state: false, blackList: false, ext: '' },
          ]);
          void persist();
        }}
      >
        + 添加正则
      </Button>
    </div>
  );
}

function M3u8Section() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">M3U8 解析器设置</h2>
      <SettingRow label="并发线程数" desc="下载 TS 切片的并发数">
        <input
          type="number"
          min={1}
          max={32}
          value={options.M3u8Thread}
          className="w-20 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ M3u8Thread: Number(e.target.value) });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="合并为 MP4" desc="合并时尝试转封装为 MP4">
        <input
          type="checkbox"
          checked={!!options.M3u8Mp4}
          onChange={(e) => {
            update({ M3u8Mp4: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="仅音频" desc="仅保留音频流">
        <input
          type="checkbox"
          checked={!!options.M3u8OnlyAudio}
          onChange={(e) => {
            update({ M3u8OnlyAudio: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="跳过解密" desc="不解密 AES-128 切片(直接合并)">
        <input
          type="checkbox"
          checked={!!options.M3u8SkipDecrypt}
          onChange={(e) => {
            update({ M3u8SkipDecrypt: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="流式落盘" desc="用 StreamSaver 直接写盘,避免内存爆炸">
        <input
          type="checkbox"
          checked={!!options.M3u8StreamSaver}
          onChange={(e) => {
            update({ M3u8StreamSaver: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="使用 ffmpeg 合并" desc="合并调用 ffmpeg.wasm 而非直接拼接">
        <input
          type="checkbox"
          checked={!!options.M3u8Ffmpeg}
          onChange={(e) => {
            update({ M3u8Ffmpeg: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="完成后自动关闭" desc="下载完成后自动关闭解析器窗口">
        <input
          type="checkbox"
          checked={!!options.M3u8AutoClose}
          onChange={(e) => {
            update({ M3u8AutoClose: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="自动下载" desc="解析出 M3U8 后自动开始下载">
        <input
          type="checkbox"
          checked={!!options.m3u8AutoDown}
          onChange={(e) => {
            update({ m3u8AutoDown: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>

      <h3 className="text-sm font-medium pt-2 border-t border-[var(--color-border]">
        m3u8dl 协议(URL Protocol)
      </h3>
      <SettingRow label="调用方式" desc="0=关闭 / 1=复制命令 / 2=协议调用">
        <select
          value={options.m3u8dl}
          className="w-32 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ m3u8dl: Number(e.target.value) as 0 | 1 | 2 });
            void persist();
          }}
        >
          <option value={0}>关闭</option>
          <option value={1}>复制命令</option>
          <option value={2}>协议调用</option>
        </select>
      </SettingRow>
      <SettingRow label="m3u8dl 命令模板" desc="支持 ${url} ${title} ${now} ${referer} ${cookie} 占位符">
        <textarea
          value={options.m3u8dlArg}
          rows={4}
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ m3u8dlArg: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="调用前确认" desc="调用 m3u8dl 前弹窗确认">
        <input
          type="checkbox"
          checked={!!options.m3u8dlConfirm}
          onChange={(e) => {
            update({ m3u8dlConfirm: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
    </div>
  );
}

function BlockUrlSection() {
  const blockUrl = useSettingsStore((s) => s.blockUrl);
  const setBlockUrl = useSettingsStore((s) => s.setBlockUrl);
  const blockUrlWhite = useSettingsStore((s) => s.blockUrlWhite);
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">屏蔽 URL</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        通过通配符匹配 URL(*=任意字符,?=单字符)屏蔽抓取,白名单模式下仅抓取匹配项。
      </p>
      <SettingRow label="白名单模式" desc="开启后仅抓取列表中的 URL">
        <input
          type="checkbox"
          checked={!!blockUrlWhite}
          onChange={(e) => {
            update({ blockUrlWhite: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <div className="space-y-1.5">
        {blockUrl.map((rule, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 px-2 py-1 rounded-[--radius-sm] bg-[var(--color-surface-dim]"
          >
            <input
              type="checkbox"
              checked={rule.state}
              onChange={() => {
                const next = blockUrl.map((r, i) =>
                  i === idx ? { ...r, state: !r.state } : r,
                );
                setBlockUrl(
                  next.map((r) => ({ url: r.url.source, state: r.state })),
                );
                void persist();
              }}
            />
            <code
              className="text-xs flex-1 truncate font-mono"
              title={rule.url.source}
            >
              {rule.url.source}
            </code>
            <Button
              variant="ghost"
              size="icon"
              title="删除"
              onClick={() => {
                const next = blockUrl.filter((_, i) => i !== idx);
                setBlockUrl(
                  next.map((r) => ({ url: r.url.source, state: r.state })),
                );
                void persist();
              }}
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const next = blockUrl.map((r) => ({
            url: r.url.source,
            state: r.state,
          }));
          next.push({ url: '*example.com*', state: false });
          setBlockUrl(next);
          void persist();
        }}
      >
        + 添加 URL
      </Button>
    </div>
  );
}

function ScriptSection() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);
  const scriptList = useSettingsStore((s) => s.scriptList);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">脚本设置</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        控制注入页面的脚本:深度搜索、缓存捕获、视频录制、屏幕捕获、WebRTC 录制。
      </p>
      <SettingRow label="始终深度搜索" desc="注入 search.js 深度扫描页面媒体">
        <input
          type="checkbox"
          checked={!!options.deepSearch}
          onChange={(e) => {
            update({ deepSearch: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <h3 className="text-sm font-medium pt-2 border-t border-[var(--color-border]">
        已注册脚本
      </h3>
      <div className="space-y-1.5">
        {Array.from(scriptList.entries()).map(([script, entry]) => (
          <div
            key={script}
            className="flex items-center gap-2 px-2 py-1 rounded-[--radius-sm] bg-[var(--color-surface-dim]"
          >
            <code className="text-xs font-mono w-32">{script}</code>
            <span className="text-xs text-[var(--color-text-muted]">
              {i18n(entry.name)} · world: {entry.world} · allFrames:{' '}
              {entry.allFrames ? '✓' : '✗'} · refresh:{' '}
              {entry.refresh ? '✓' : '✗'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CopySection() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">复制模板</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        自定义右键复制的命令模板,支持 ${'{url}'} ${'{referer}'} ${'{title}'}{' '}
        ${'{now}'} 占位符。
      </p>
      <SettingRow label="HLS m3u8" desc="M3U8 资源复制模板">
        <textarea
          value={options.copyM3U8}
          rows={2}
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ copyM3U8: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="DASH mpd" desc="MPD 资源复制模板">
        <textarea
          value={options.copyMPD}
          rows={2}
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ copyMPD: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="其他文件" desc="非 m3u8/mpd 资源复制模板">
        <textarea
          value={options.copyOther}
          rows={2}
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ copyOther: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
    </div>
  );
}

function ReplaceTagsSection() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">替换标签</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        自定义文件名模板、User-Agent 等可替换变量。支持 ${'{url}'} ${'{title}'}{' '}
        ${'{ext}'} 等占位符。
      </p>
      <SettingRow label="自定义保存文件名" desc="${'{title}'}.${'{ext}'} 默认">
        <textarea
          value={options.downFileName}
          rows={2}
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ downFileName: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="User-Agent" desc="嗅探请求的默认 UA">
        <textarea
          value={options.userAgent}
          rows={2}
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ userAgent: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="移动端 User-Agent" desc="模拟手机嗅探时的 UA">
        <textarea
          value={options.MobileUserAgent}
          rows={2}
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ MobileUserAgent: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
    </div>
  );
}

function DownloaderSection() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">下载器</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        猫抓内置下载器行为控制,关闭后改用 Chrome 原生下载。
      </p>
      <SettingRow label="始终不启用猫抓下载器" desc="启用 Chrome 内置下载">
        <input
          type="checkbox"
          checked={!!options.catDownload}
          onChange={(e) => {
            update({ catDownload: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="下载完自动关闭页面" desc="下载完成后关闭下载器窗口">
        <input
          type="checkbox"
          checked={!!options.downAutoClose}
          onChange={(e) => {
            update({ downAutoClose: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="后台打开下载器" desc="下载器页面在后台打开">
        <input
          type="checkbox"
          checked={!!options.downActive}
          onChange={(e) => {
            update({ downActive: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="边下边存" desc="使用 StreamSaver 流式写盘">
        <input
          type="checkbox"
          checked={!!options.downStream}
          onChange={(e) => {
            update({ downStream: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
    </div>
  );
}

function CustomCssSection() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">自定义 CSS</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        注入到 popup / 选项页 / 解析器页面的自定义样式,慎用 !important。
      </p>
      <textarea
        value={options.css}
        rows={12}
        placeholder="/* 自定义样式 */"
        className="w-full px-3 py-2 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
        onChange={(e) => {
          update({ css: e.target.value });
          void persist();
        }}
      />
    </div>
  );
}

function MqttSection() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">MQTT 推送</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        将嗅探到的资源通过 MQTT 推送到指定 broker,适合与外部自动化脚本联动。
      </p>
      <SettingRow label="启用 MQTT" desc="嗅探到资源时推送到 broker">
        <input
          type="checkbox"
          checked={!!options.mqttEnable}
          onChange={(e) => {
            update({ mqttEnable: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="Broker 地址">
        <input
          type="text"
          value={options.mqttBroker}
          placeholder="test.mosquitto.org"
          className="w-64 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttBroker: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="端口">
        <input
          type="number"
          min={1}
          max={65535}
          value={options.mqttPort}
          className="w-20 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttPort: Number(e.target.value) });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="路径" desc="WebSocket 路径">
        <input
          type="text"
          value={options.mqttPath}
          placeholder="/mqtt"
          className="w-32 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttPath: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="协议">
        <select
          value={options.mqttProtocol}
          className="w-24 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttProtocol: e.target.value as 'wss' | 'ws' });
            void persist();
          }}
        >
          <option value="wss">wss</option>
          <option value="ws">ws</option>
        </select>
      </SettingRow>
      <SettingRow label="Client ID">
        <input
          type="text"
          value={options.mqttClientId}
          className="w-64 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttClientId: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="用户名">
        <input
          type="text"
          value={options.mqttUser}
          className="w-64 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttUser: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="密码">
        <input
          type="password"
          value={options.mqttPassword}
          className="w-64 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttPassword: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="主题" desc="推送目标 topic">
        <input
          type="text"
          value={options.mqttTopic}
          placeholder="cat-catch/media"
          className="w-64 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttTopic: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="QoS" desc="0=最多一次 / 1=至少一次 / 2=只有一次">
        <select
          value={options.mqttQos}
          className="w-24 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttQos: Number(e.target.value) as 0 | 1 | 2 });
            void persist();
          }}
        >
          <option value={0}>0</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </SettingRow>
      <SettingRow label="标题最大长度">
        <input
          type="number"
          min={1}
          max={1000}
          value={options.mqttTitleLength}
          className="w-20 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttTitleLength: Number(e.target.value) });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="数据格式模板" desc="${url} ${title} 等占位符">
        <textarea
          value={options.mqttDataFormat}
          rows={4}
          placeholder='{"url":"${url}","title":"${title}"}'
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ mqttDataFormat: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
    </div>
  );
}

function OperationSection() {
  const settings = useSettingsStore();

  const handleExport = async () => {
    const data = await chrome.storage.sync.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cat-catch-options-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await chrome.storage.sync.set(data);
        await settings.loadFromSync();
        alert('导入成功');
      } catch (e) {
        alert('导入失败: ' + (e as Error).message);
      }
    };
    input.click();
  };

  const handleClear = async () => {
    if (!confirm('确定清除所有抓取数据?此操作不可恢复。')) return;
    await chrome.storage.local.remove([
      'mediaData',
      'mediaDataM3u8',
      'mediaDataMpd',
    ]);
    alert('已清除');
  };

  const handleResetAll = async () => {
    if (!confirm('确定重置所有设置到默认值?')) return;
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set({
      ...DEFAULT_OPTIONS,
      Ext: DEFAULT_EXT_RULES,
      Type: DEFAULT_TYPE_RULES,
      Regex: DEFAULT_REGEX_RULES,
      blockUrl: [],
    });
    await settings.loadFromSync();
    alert('已重置');
  };

  const handleReload = () => chrome.runtime.reload();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">操作</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        导入 / 导出 / 清除 / 重置 / 重启扩展。
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          导出设置
        </Button>
        <Button variant="outline" size="sm" onClick={handleImport}>
          导入配置
        </Button>
        <Button variant="ghost" size="sm" onClick={handleClear}>
          清除抓取数据
        </Button>
        <Button variant="ghost" size="sm" onClick={handleResetAll}>
          重置所有设置
        </Button>
        <Button variant="primary" size="sm" onClick={handleReload}>
          重启扩展
        </Button>
      </div>
    </div>
  );
}

function Aria2Section() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Aria2 RPC 设置</h2>
      <SettingRow label="启用 Aria2 推送" desc="嗅探到的资源推送到 Aria2 下载">
        <input
          type="checkbox"
          checked={!!options.enableAria2Rpc}
          onChange={(e) => {
            update({ enableAria2Rpc: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="RPC 地址" desc="Aria2 JSON-RPC 接口">
        <input
          type="text"
          value={options.aria2Rpc}
          className="w-64 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ aria2Rpc: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="RPC Token" desc="Aria2 rpc-secret">
        <input
          type="password"
          value={options.aria2RpcToken}
          className="w-64 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ aria2RpcToken: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="下载目录" desc="Aria2 保存路径">
        <input
          type="text"
          value={options.aria2RpcDir}
          placeholder="留空使用 Aria2 默认"
          className="w-64 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ aria2RpcDir: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="附带 Referer" desc="推送时附带 referer 头">
        <input
          type="checkbox"
          checked={!!options.enableAria2RpcReferer}
          onChange={(e) => {
            update({ enableAria2RpcReferer: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
    </div>
  );
}

function Send2LocalSection() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">发送到本地</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        将嗅探到的资源推送到本地 HTTP 服务(aria2/Motrix/自建脚本)。
      </p>
      <SettingRow label="启用发送" desc="嗅探时自动推送">
        <input
          type="checkbox"
          checked={!!options.send2local}
          onChange={(e) => {
            update({ send2local: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="仅手动发送" desc="关闭自动推送,仅 popup 手动触发">
        <input
          type="checkbox"
          checked={!!options.send2localManual}
          onChange={(e) => {
            update({ send2localManual: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="目标 URL">
        <input
          type="text"
          value={options.send2localURL}
          className="w-64 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ send2localURL: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="HTTP 方法">
        <select
          value={options.send2localMethod}
          className="w-24 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ send2localMethod: e.target.value as 'GET' | 'POST' });
            void persist();
          }}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
      </SettingRow>
      <SettingRow label="请求类型" desc="0=JSON / 1=Form / 2=Text / 3=None">
        <select
          value={options.send2localType}
          className="w-24 px-2 py-1 border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ send2localType: Number(e.target.value) as 0 | 1 | 2 | 3 });
            void persist();
          }}
        >
          <option value={0}>JSON</option>
          <option value={1}>Form</option>
          <option value={2}>Text</option>
          <option value={3}>None</option>
        </select>
      </SettingRow>
      <SettingRow label="请求体模板" desc="${action} ${data} ${tabId} 占位符">
        <textarea
          value={options.send2localBody}
          rows={4}
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ send2localBody: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="自定义 Headers" desc="JSON 格式">
        <textarea
          value={options.send2localHeaders}
          rows={3}
          placeholder='{"X-Token": "xxx"}'
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ send2localHeaders: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
    </div>
  );
}

function InvokeSection() {
  const options = useSettingsStore((s) => s.options);
  const update = useSettingsStore((s) => s.updateOptions);
  const persist = useSettingsStore((s) => s.persistOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">远程调用 (Invoke App)</h2>
      <p className="text-xs text-[var(--color-text-muted]">
        通过 URL Protocol 调用本地程序(如 N_m3u8dl-RE / yt-dlp)处理资源。
      </p>
      <SettingRow label="启用远程调用" desc='popup 中显示"调用本地程序"按钮'>
        <input
          type="checkbox"
          checked={!!options.invoke}
          onChange={(e) => {
            update({ invoke: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="调用前确认">
        <input
          type="checkbox"
          checked={!!options.invokeConfirm}
          onChange={(e) => {
            update({ invokeConfirm: e.target.checked });
            void persist();
          }}
        />
      </SettingRow>
      <SettingRow label="调用模板" desc="${url} ${title} ${now} ${referer} ${cookie} 占位符">
        <textarea
          value={options.invokeText}
          rows={5}
          className="w-full px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
          onChange={(e) => {
            update({ invokeText: e.target.value });
            void persist();
          }}
        />
      </SettingRow>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">关于</h2>
      <p className="text-sm leading-relaxed text-[var(--color-text-muted]">
        猫抓 (cat-catch) 资源嗅探扩展 - React 19 + WXT 重构版。
      </p>
      <p className="text-xs text-[var(--color-text-muted]">
        本项目为原 cat-catch 的 1:1 还原重写,使用 React 19 +
        TypeScript + radix-ui + Tailwind v4 + Zustand 技术栈。
      </p>
      <Button
        variant="primary"
        size="md"
        onClick={() =>
          window.open('https://github.com/xifangczy/cat-catch', '_blank')
        }
      >
        原项目仓库
      </Button>
    </div>
  );
}

function SettingRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--color-border] last:border-0">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {desc && (
          <p className="text-xs text-[var(--color-text-muted] mt-0.5">{desc}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
