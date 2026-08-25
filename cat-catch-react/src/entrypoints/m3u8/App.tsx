import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Download,
  Trash2,
  FileText,
  Loader2,
  Film,
  StopCircle,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Settings2,
  MonitorPlay,
  Terminal,
  Music2,
  Captions,
  Filter,
  FlipHorizontal,
  Wand2,
} from 'lucide-react';
import {
  fetchAndParseM3u8,
  parseM3u8,
  type M3u8ParseResult,
  type M3u8Level,
} from '@lib/m3u8-parser';
import { Downloader, type Fragment } from '@lib/m3u8-downloader';
import {
  fetchKey,
  fetchInitSegment,
  createDecryptPipeline,
  mergeBuffers,
  preprocessStep,
  parseKey,
} from '@lib/m3u8-merge';
import { byteToSize, secToTime } from '@lib/function';
import { Button } from '@components/ui/Button';
import { cn } from '@lib/utils';
import { createFileStream, type FileStream } from '@lib/stream-saver';
import { Template, type TemplateContext } from '@lib/template';
import { useSettingsStore } from '@stores/settings';

/**
 * M3U8 解析器
 * 1:1 还原原 m3u8.html + js/m3u8.js 的核心交互
 * 接通 lib/m3u8-parser + lib/m3u8-downloader + lib/m3u8-merge
 *
 * 流程:输入 m3u8 URL + referer -> fetchAndParseM3u8 -> 多码率选择(master) ->
 *   预获取 key/initSegment -> Downloader.start() -> 合并落盘
 */
type Phase = 'input' | 'levels' | 'result';
type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error';

export default function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const [url, setUrl] = useState(params.get('url') ?? '');
  const [referer, setReferer] = useState(params.get('referer') ?? '');
  const [phase, setPhase] = useState<Phase>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // MPD 转入:从 mpd 页面拉取转换好的 m3u8 文本(还原 m3u8.js getMpdId 分支)
  const getMpdId = params.get('getMpdId');

  const [result, setResult] = useState<M3u8ParseResult | null>(null);
  const [levelChoice, setLevelChoice] = useState<string>('');
  const [fragments, setFragments] = useState<Fragment[]>([]);

  // 下载选项
  const [thread, setThread] = useState(6);
  const [skipDecrypt, setSkipDecrypt] = useState(false);
  const [dataPreprocessing, setDataPreprocessing] = useState(false);
  const [autoClose, setAutoClose] = useState(false);
  const [streamingSave, setStreamingSave] = useState(false);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(0);

  // 下载状态
  const downRef = useRef<Downloader | null>(null);
  const keyContentRef = useRef<Map<string, ArrayBuffer | true>>(new Map());
  const initDataRef = useRef<Map<string, ArrayBuffer | true>>(new Map());
  const streamRef = useRef<FileStream | null>(null);
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [success, setSuccess] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [buffersize, setBuffersize] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentFragment, setCurrentFragment] = useState('');

  // HLS 在线播放(还原原 m3u8.html #play + hls.js attach/detach)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(false);
  const [hlsError, setHlsError] = useState('');

  // 自定义 Key / IV(还原原 m3u8.html #customKey + #customIV)
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [customIV, setCustomIV] = useState('');

  // m3u8dl 协议调用设置(还原原 m3u8.js G.m3u8dl / G.m3u8dlArg / G.m3u8dlConfirm)
  const m3u8dlMode = useSettingsStore((s) => s.options.m3u8dl);
  const m3u8dlArgTpl = useSettingsStore((s) => s.options.m3u8dlArg);
  const m3u8dlConfirm = useSettingsStore((s) => s.options.m3u8dlConfirm);

  // 自定义 m3u8 文本/文件上传解析(还原原 m3u8.html #m3u8Text + #uploadM3U8)
  const [showTextInput, setShowTextInput] = useState(false);
  const [m3u8Text, setM3u8Text] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 切片选择 + 正则过滤 + 反选(还原原 m3u8.js #regular + #invertSelection)
  const [selectedSet, setSelectedSet] = useState<Set<number>>(new Set());
  const [regexInput, setRegexInput] = useState('');
  const [regexError, setRegexError] = useState('');

  // fragments 变化时,默认全部选中
  useEffect(() => {
    setSelectedSet(new Set(fragments.map((f) => f.index)));
    setRegexInput('');
    setRegexError('');
  }, [fragments]);

  // ===== MPD 转入流程:从源 tab 拉取转换后的 m3u8 文本并直接解析 =====
  useEffect(() => {
    if (!getMpdId) return;
    const sourceTabId = Number(getMpdId);
    if (!Number.isFinite(sourceTabId) || sourceTabId <= 0) return;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await chrome.tabs.sendMessage(sourceTabId, 'getM3u8');
        const m3u8Content = resp?.m3u8Content as string | undefined;
        if (!m3u8Content) {
          setError('未收到 mpd 页面转换的 m3u8 内容');
          return;
        }
        // 用源 tab 的 url 作为 baseUrl,便于相对路径解析
        let baseUrl = resp?.mediaInfo as string | undefined;
        if (!baseUrl) {
          try {
            const t = await chrome.tabs.get(sourceTabId);
            baseUrl = t?.url;
          } catch {
            /* ignore */
          }
        }
        const parsed = parseM3u8(m3u8Content, baseUrl);
        setResult(parsed);
        keyContentRef.current = new Map();
        initDataRef.current = new Map();
        if (parsed.isMaster && parsed.levels.length > 0) {
          setPhase('levels');
        } else {
          setFragments(parsed.fragments);
          setRangeEnd(parsed.fragments.length);
          setPhase('result');
          void prefetchKeysAndInit(parsed.fragments, referer);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getMpdId]);

  // ===== 解析 =====
  const parse = useCallback(
    async (targetUrl?: string, headers?: Record<string, string>) => {
      const u = targetUrl ?? url;
      if (!u) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetchAndParseM3u8(u, headers ?? (referer ? { referer } : undefined));
        setResult(res);
        keyContentRef.current = new Map();
        initDataRef.current = new Map();
        if (res.isMaster && res.levels.length > 0) {
          setPhase('levels');
        } else {
          setFragments(res.fragments);
          setRangeEnd(res.fragments.length);
          setPhase('result');
          void prefetchKeysAndInit(res.fragments, referer);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [url, referer],
  );

  // 选择某个 level(master playlist 的子 m3u8)
  const selectLevel = useCallback(
    (lvl: M3u8Level) => {
      setLevelChoice(lvl.url);
      void parse(lvl.url, referer ? { referer } : undefined);
    },
    [parse, referer],
  );

  // 预获取所有 key 与 initSegment(还原 m3u8.js L693-732)
  const prefetchKeysAndInit = useCallback(
    async (frags: Fragment[], ref: string) => {
      const headers = ref ? { referer: ref } : undefined;
      const keyUris = new Set<string>();
      const initUrls = new Set<string>();
      for (const f of frags) {
        if (f.decryptdata?.uri) keyUris.add(f.decryptdata.uri);
        if (f.initSegment?.url) initUrls.add(f.initSegment.url);
      }
      await Promise.all([
        ...Array.from(keyUris).map(async (uri) => {
          if (keyContentRef.current.get(uri)) return;
          keyContentRef.current.set(uri, true);
          const key = await fetchKey(uri);
          if (key) keyContentRef.current.set(uri, key);
        }),
        ...Array.from(initUrls).map(async (u) => {
          if (initDataRef.current.get(u)) return;
          initDataRef.current.set(u, true);
          const frag0 = frags.find((f) => f.initSegment?.url === u);
          const br = frag0?.initSegment?.byteRange;
          const buf = await fetchInitSegment(u, br);
          initDataRef.current.set(u, buf);
        }),
      ]);
    },
    [],
  );

  // ===== 自定义 m3u8 文本解析(还原原 m3u8.js L179-191 #parse 文本分支) =====
  // 1. 粘贴 m3u8 文本或上传 .m3u8 文件
  // 2. 用 baseUrl 解析相对路径(可选)
  // 3. 调用 parseM3u8(text, baseUrl) 直接解析,无需网络请求
  const parseText = useCallback(() => {
    const text = m3u8Text.trim();
    if (!text) {
      setError('请粘贴 m3u8 文本或上传 .m3u8 文件');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const parsed = parseM3u8(text, baseUrl.trim() || undefined);
      setResult(parsed);
      keyContentRef.current = new Map();
      initDataRef.current = new Map();
      if (parsed.isMaster && parsed.levels.length > 0) {
        setPhase('levels');
      } else {
        setFragments(parsed.fragments);
        setRangeEnd(parsed.fragments.length);
        setPhase('result');
        void prefetchKeysAndInit(parsed.fragments, referer);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [m3u8Text, baseUrl, referer, prefetchKeysAndInit]);

  // 文件上传:readAsText 读取 .m3u8 文件内容到 textarea
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setM3u8Text(String(reader.result ?? ''));
    };
    reader.readAsText(file);
  }, []);

  // ===== 切片选择工具(还原原 m3u8.js L1370-1396 #regular + #invertSelection) =====
  // 正则批量选中:输入正则,回车批量勾选匹配 url 的切片(不匹配的取消勾选)
  const applyRegex = useCallback(() => {
    const pattern = regexInput.trim();
    if (!pattern) {
      setRegexError('');
      setSelectedSet(new Set(fragments.map((f) => f.index)));
      return;
    }
    try {
      const reg = new RegExp(pattern);
      setRegexError('');
      const next = new Set<number>();
      for (const f of fragments) {
        if (reg.test(f.url)) next.add(f.index);
      }
      setSelectedSet(next);
    } catch (e) {
      setRegexError(e instanceof Error ? e.message : String(e));
    }
  }, [regexInput, fragments]);

  // 反选:全集 - 当前选中集
  const invertSelection = useCallback(() => {
    setSelectedSet((prev) => {
      const next = new Set<number>();
      for (const f of fragments) {
        if (!prev.has(f.index)) next.add(f.index);
      }
      return next;
    });
  }, [fragments]);

  // 单个切片勾选切换
  const toggleSegment = useCallback((idx: number) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // 全选/全不选
  const selectAll = useCallback(() => {
    setSelectedSet(new Set(fragments.map((f) => f.index)));
  }, [fragments]);
  const selectNone = useCallback(() => {
    setSelectedSet(new Set());
  }, [fragments]);

  // ===== 应用自定义 Key/IV(还原原 m3u8.js L1195-1244) =====
  // 在 startDownload 之前调用:覆盖 fragment.decryptdata 和 keyContent Map
  const applyCustomKeyIv = useCallback(
    (frags: Fragment[]): { ok: boolean; error?: string } => {
      const keyStr = customKey.trim();
      if (keyStr) {
        let keyBytes: Uint8Array;
        try {
          keyBytes = parseKey(keyStr);
        } catch {
          return { ok: false, error: '自定义 Key 格式错误(hex 32 位 / base64)' };
        }
        // 强制所有切片加密,并指向 customKey 占位 uri
        const customUri = 'customKey';
        for (const f of frags) {
          f.encrypted = true;
          if (!f.decryptdata) {
            f.decryptdata = { method: 'AES-128', uri: customUri };
          } else {
            f.decryptdata.uri = customUri;
            f.decryptdata.method = f.decryptdata.method || 'AES-128';
          }
        }
        // 覆盖 keyContent Map 中已有的所有 key 为自定义值
        const customKeyBuf = keyBytes.buffer.slice(0) as ArrayBuffer;
        keyContentRef.current.forEach((_v, k) => {
          keyContentRef.current.set(k, customKeyBuf);
        });
        // 同时放入 customKey 占位
        keyContentRef.current.set(customUri, customKeyBuf);
      }
      // 自定义 IV(还原 m3u8.js StringToUint8Array)
      const ivStr = customIV.trim();
      if (ivStr) {
        const encoder = new TextEncoder();
        const ivBytes = encoder.encode(ivStr);
        for (const f of frags) {
          if (!f.decryptdata) f.decryptdata = { method: 'AES-128' };
          f.decryptdata.iv = ivBytes;
        }
      }
      return { ok: true };
    },
    [customKey, customIV],
  );

  // ===== 调用 m3u8dl 协议(还原原 m3u8.js #m3u8DL 按钮 L970-985) =====
  // 1. 渲染命令模板(${url} ${title} ${now} ${referer} ${cookie})
  // 2. 根据 m3u8dl 模式:0=禁用,1=base64 编码,2=原文
  // 3. 拼装 m3u8dl: 协议链接,长度 >= 2046 警告
  // 4. m3u8dlConfirm=true 时弹窗确认
  // 5. chrome.tabs.update({ url }) 触发外部程序
  const invokeM3u8dl = useCallback(() => {
    if (!url) return;
    if (url.startsWith('blob:')) {
      setError('blob: m3u8 URL 不支持调用 m3u8dl');
      return;
    }
    if (m3u8dlMode === 0) {
      setError('未启用 m3u8dl 协议,请到设置页开启');
      return;
    }
    // 构造模板上下文(还原原 _data 字段)
    const ctx: TemplateContext = {
      url,
      referer,
      initiator: referer,
      webUrl: referer,
      title: document.title || 'm3u8',
      cookie: '', // 浏览器扩展页面无 cookie,需要时通过 background 获取
      tabId: 0,
    };
    let arg = Template.render(m3u8dlArgTpl, ctx);
    // 复制到剪贴板(还原原 m3u8.js L979 navigator.clipboard.writeText)
    void navigator.clipboard?.writeText(arg).catch(() => undefined);
    // 模式 1 = base64 编码,模式 2 = 原文
    const payload = m3u8dlMode === 1 ? btoa(arg) : arg;
    const m3u8dlUrl = 'm3u8dl:' + payload;
    if (m3u8dlUrl.length >= 2046) {
      setError('m3u8dl 参数过长 (>= 2046),请精简命令模板或减少参数');
      return;
    }
    // 调用前确认
    if (m3u8dlConfirm && !window.confirm(`确认调用 m3u8dl?\n\n${arg}`)) {
      return;
    }
    chrome.tabs.update({ url: m3u8dlUrl });
  }, [url, referer, m3u8dlMode, m3u8dlArgTpl, m3u8dlConfirm]);

  // ===== 合并下载 =====
  // target: 'download' 保存到本地; 'ffmpeg' 发送到在线 ffmpeg 服务(还原原 m3u8.js #onlineFFmpeg + iframeFFmpeg)
  const startDownload = useCallback(async (target: 'download' | 'ffmpeg' = 'download') => {
    if (!fragments.length) return;
    // 按选择状态过滤切片(还原原 m3u8.js selected 标志)
    const selectedFrags = fragments.filter((f) => selectedSet.has(f.index));
    if (!selectedFrags.length) {
      setError('未选中任何切片,请至少勾选一个');
      setStatus('error');
      return;
    }
    // range 范围过滤(基于原始 fragments 索引)
    const startIdx = Math.max(0, rangeStart - 1);
    const endIdx = rangeEnd > 0 ? rangeEnd : fragments.length;
    const finalFrags = selectedFrags.filter((f) => f.index >= startIdx && f.index < endIdx);
    if (!finalFrags.length) {
      setError('range 范围与选中切片无交集');
      setStatus('error');
      return;
    }
    // 应用自定义 Key/IV(在创建 Downloader 前覆盖 fragments)
    const applyResult = applyCustomKeyIv(finalFrags);
    if (!applyResult.ok) {
      setError(applyResult.error ?? '自定义 Key/IV 应用失败');
      setStatus('error');
      return;
    }
    const down = new Downloader(finalFrags, thread);
    downRef.current = down;


    if (dataPreprocessing) {
      down.use(preprocessStep, 'preprocess');
    }
    down.use(
      createDecryptPipeline({
        skipDecrypt,
        recorder: false,
        keyContent: keyContentRef.current,
        initData: initDataRef.current,
      }),
      'decrypt',
    );

    setSuccess(0);
    setErrorCount(0);
    setBuffersize(0);
    setDuration(0);
    setStatus('downloading');

    // 流式落盘:开始时创建文件输出流(成功后 sequentialPush 直接写盘)
    let fileStream: FileStream | null = null;
    if (streamingSave) {
      const name = deriveFilename(url) || 'm3u8_merged';
      try {
        fileStream = await createFileStream(`${name}.ts`);
        streamRef.current = fileStream;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          setStatus('idle');
          return;
        }
        // 其它错误回退到内存合并
        console.warn('createFileStream failed, fallback to blob', e);
      }
    }

    // start 事件:注入 referer / cookie / credentials
    down.on('start', (frag: unknown, options?: unknown) => {
      const f = frag as Fragment;
      setCurrentFragment(`#${f.index} ${f.url.slice(0, 60)}`);
      if (!options) return;
      const reqInit = options as RequestInit;
      const headers: Record<string, string> = {
        ...((reqInit.headers as Record<string, string> | undefined) ?? {}),
      };
      if (referer) headers.referer = referer;
      reqInit.headers = headers;
      // cookie 由浏览器随 fetch 自动发送(同域 + credentials='include')
      reqInit.credentials = 'include';
    });
    down.on('completed', () => {
      setSuccess(down.success);
      setBuffersize(down.buffersize);
      setDuration(down.duration);
    });
    down.on('downloadError', () => {
      setErrorCount(down.errorIndexes.size);
    });
    // 流式:按完成顺序写入文件
    down.on('sequentialPush', (buffer: unknown) => {
      const buf = buffer as ArrayBuffer;
      if (fileStream?.streaming) {
        fileStream.write(new Uint8Array(buf));
      }
    });
    down.on('allCompleted', async (buffer: unknown) => {
      const buf = buffer as (ArrayBuffer | undefined)[];
      const name = deriveFilename(url) || 'm3u8_merged';
      if (target === 'ffmpeg') {
        // 在线 ffmpeg 合并:把合并后的 Blob 发送给 background → ffmpeg 服务(还原原 m3u8.js L1874-1894)
        const blob = mergeBuffers(buf);
        const blobUrl = URL.createObjectURL(blob);
        chrome.runtime.sendMessage({
          Message: 'catCatchFFmpeg',
          file: blobUrl,
          title: name,
          output: 'mp4',
          active: true,
        });
        // 不立即 revoke,ffmpeg 服务处理完后由 background 触发下载
        setStatus('done');
        if (autoClose) window.close();
        return;
      }
      if (fileStream?.streaming) {
        // 流式落盘:文件已逐段写入,只需关闭
        await fileStream.close();
        streamRef.current = null;
      } else {
        // 内存合并 + <a download>
        const blob = mergeBuffers(buf);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${name}.ts`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      setStatus('done');
      if (autoClose) window.close();
    });
    down.on('error', (msg: unknown) => {
      setError(String(msg));
      setStatus('error');
    });

    // 下载全部 finalFrags(selectedSet + range 已过滤)
    down.start(0, finalFrags.length);
  }, [fragments, thread, dataPreprocessing, skipDecrypt, rangeStart, rangeEnd, url, autoClose, streamingSave, referer, applyCustomKeyIv, selectedSet]);

  const stopDownload = useCallback(() => {
    downRef.current?.stop();
    setStatus('idle');
    if (streamRef.current) {
      void streamRef.current.close();
      streamRef.current = null;
    }
  }, []);

  // ===== HLS 在线播放(还原原 m3u8.js #play 按钮) =====
  // 切换:attachMedia(video) -> 播放;再次点击 -> detachMedia + 隐藏
  const togglePlay = useCallback(() => {
    if (playing) {
      hlsRef.current?.detachMedia();
      setPlaying(false);
      setHlsError('');
      return;
    }
    const video = videoRef.current;
    if (!video || !url) return;
    // 原生 HLS 支持(Safari)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      void video.play().catch(() => undefined);
      setPlaying(true);
      return;
    }
    if (!Hls.isSupported()) {
      setHlsError('当前浏览器不支持 HLS 播放');
      return;
    }
    const hls = new Hls({ enableWorker: false, debug: false });
    hlsRef.current = hls;
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      void video.play().catch(() => undefined);
      setPlaying(true);
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data?.fatal) {
        setHlsError(`HLS 错误:${data.type} / ${data.details ?? 'unknown'}`);
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          try { hls.startLoad(); } catch { /* ignore */ }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.recoverMediaError(); } catch { /* ignore */ }
        } else {
          hls.destroy();
          hlsRef.current = null;
          setPlaying(false);
        }
      }
    });
  }, [playing, url]);

  // 卸载时销毁 hls 实例
  useEffect(() => {
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, []);

  const total = fragments.length;
  const progress = total ? Math.round((success / total) * 100) : 0;
  const encrypted = fragments.some((f) => f.encrypted);
  const keyReady = !encrypted || Array.from(keyContentRef.current.values()).some(
    (v) => v instanceof ArrayBuffer,
  );

  return (
    <div className="min-h-screen bg-[var(--color-surface-dim] text-[var(--color-text]">
      <header className="border-b border-[var(--color-border] bg-[var(--color-surface] px-6 py-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-[var(--color-primary]" />
          M3U8 解析器
        </h1>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-[--radius-md] bg-[var(--color-danger]/10 text-[var(--color-danger] text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* 输入区 */}
        {phase === 'input' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted]">M3U8 URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void parse()}
                placeholder="粘贴 m3u8 URL"
                className="w-full mt-1 px-3 py-2 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface] text-sm focus:outline-none focus:border-[var(--color-primary]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted]">Referer(可选)</label>
              <input
                value={referer}
                onChange={(e) => setReferer(e.target.value)}
                placeholder="https://example.com/"
                className="w-full mt-1 px-3 py-2 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface] text-sm focus:outline-none focus:border-[var(--color-primary]"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="primary" onClick={() => void parse()} disabled={loading || !url}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                解析
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowTextInput((v) => !v)}
                title="粘贴 m3u8 文本或上传 .m3u8 文件直接解析(无需网络)"
              >
                <FileText className="w-4 h-4" />
                {showTextInput ? '收起文本' : '自定义文本/文件'}
              </Button>
            </div>

            {/* 自定义 m3u8 文本/文件上传解析(还原原 m3u8.html #m3u8Text + #uploadM3U8) */}
            {showTextInput && (
              <div className="space-y-2 p-3 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface]">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    自定义 m3u8 文本
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs px-2 py-1 rounded-[--radius-md] border border-[var(--color-border] hover:bg-[var(--color-surface-dim]"
                  >
                    上传 .m3u8 文件
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".m3u8,text/plain"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                <textarea
                  value={m3u8Text}
                  onChange={(e) => setM3u8Text(e.target.value)}
                  placeholder="#EXTM3U&#10;#EXT-X-VERSION:3&#10;#EXTINF:10.0,&#10;https://example.com/seg-1.ts&#10;..."
                  rows={8}
                  className="w-full px-2 py-1.5 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface-dim] text-xs font-mono focus:outline-none focus:border-[var(--color-primary] resize-y"
                />
                <div>
                  <label className="text-xs text-[var(--color-text-muted]">BaseURL(可选,用于解析相对路径)</label>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://example.com/path/"
                    className="w-full mt-1 px-2 py-1.5 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface-dim] text-xs font-mono focus:outline-none focus:border-[var(--color-primary]"
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={parseText}
                  disabled={loading || !m3u8Text.trim()}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  解析文本
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 多码率选择(master) */}
        {phase === 'levels' && result && (
          <div className="space-y-3">
            <div className="text-sm text-[var(--color-text-muted]">
              检测到 master playlist,共 {result.levels.length} 个码率,默认选最大带宽
            </div>
            <div className="space-y-1.5">
              {result.levels
                .slice()
                .sort((a, b) => b.bandwidth - a.bandwidth)
                .map((lvl, idx) => (
                  <button
                    key={lvl.url}
                    onClick={() => void selectLevel(lvl)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-[--radius-md] border text-left text-sm',
                      'hover:bg-[var(--color-surface-dim] border-[var(--color-border]',
                      idx === 0 && 'border-[var(--color-primary] bg-[var(--color-primary]/5',
                    )}
                  >
                    <Film className="w-4 h-4 text-[var(--color-text-muted] shrink-0" />
                    <span className="flex-1 truncate font-mono text-xs">{lvl.url}</span>
                    {lvl.resolution && (
                      <span className="text-xs text-[var(--color-text-muted]">{lvl.resolution}</span>
                    )}
                    <span className="text-xs font-mono">
                      {(lvl.bandwidth / 1000).toFixed(0)} Kbps
                    </span>
                  </button>
                ))}
            </div>

            {/* 音轨轨道(还原原 m3u8.js #more_audio) */}
            {result.audioTracks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs text-[var(--color-text-muted] flex items-center gap-1.5 mt-2">
                  <Music2 className="w-3.5 h-3.5" />
                  音轨轨道 ({result.audioTracks.length})
                </div>
                {result.audioTracks.map((tr, idx) => (
                  <button
                    key={tr.url + idx}
                    onClick={() => void selectLevel(tr)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-[--radius-md] border border-[var(--color-border] hover:bg-[var(--color-surface-dim] text-left text-sm"
                  >
                    <Music2 className="w-4 h-4 text-[var(--color-text-muted] shrink-0" />
                    <span className="flex-1 truncate font-mono text-xs">{tr.url}</span>
                    <span className="text-xs text-[var(--color-text-muted]">
                      {tr.lang || tr.name || `track ${idx + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* 字幕轨道(还原原 m3u8.js #more_subtitle) */}
            {result.subtitleTracks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs text-[var(--color-text-muted] flex items-center gap-1.5 mt-2">
                  <Captions className="w-3.5 h-3.5" />
                  字幕轨道 ({result.subtitleTracks.length})
                </div>
                {result.subtitleTracks.map((tr, idx) => (
                  <button
                    key={tr.url + idx}
                    onClick={() => void selectLevel(tr)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-[--radius-md] border border-[var(--color-border] hover:bg-[var(--color-surface-dim] text-left text-sm"
                  >
                    <Captions className="w-4 h-4 text-[var(--color-text-muted] shrink-0" />
                    <span className="flex-1 truncate font-mono text-xs">{tr.url}</span>
                    <span className="text-xs text-[var(--color-text-muted]">
                      {tr.lang || tr.name || `track ${idx + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 解析结果 + 下载 */}
        {phase === 'result' && (
          <>
            {/* 信息条 */}
            <div className="flex items-center gap-4 px-3 py-2 bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] text-sm">
              <span>
                共 <strong>{total}</strong> 切片
              </span>
              <span className="text-[var(--color-text-muted]">|</span>
              <span>时长 {secToTime(duration || (result?.totalDuration ?? 0))}</span>
              {encrypted && (
                <>
                  <span className="text-[var(--color-text-muted]">|</span>
                  <span className="flex items-center gap-1 text-[var(--color-warning]">
                    <KeyRound className="w-3.5 h-3.5" />
                    加密 {keyReady ? '(key 就绪)' : '(获取中...)'}
                  </span>
                </>
              )}
            </div>

            {/* 切片列表(折叠) */}
            <details className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border]">
              <summary className="px-3 py-2 cursor-pointer text-sm hover:bg-[var(--color-surface-dim] rounded-[--radius-md]">
                查看切片列表 ({total},选中 {selectedSet.size})
              </summary>
              {/* 切片选择工具栏(还原原 m3u8.js #regular + #invertSelection) */}
              <div className="px-3 py-2 border-b border-[var(--color-border] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={regexInput}
                    onChange={(e) => setRegexInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyRegex(); }}
                    placeholder="正则过滤(回车批量选中匹配的)"
                    className="flex-1 min-w-[200px] px-2 py-1 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface-dim] text-xs font-mono focus:outline-none focus:border-[var(--color-primary]"
                  />
                  <Button size="sm" variant="ghost" onClick={applyRegex} title="按正则批量选中">
                    <Filter className="w-3.5 h-3.5" />
                    正则选中
                  </Button>
                  <Button size="sm" variant="ghost" onClick={invertSelection} title="反转选中状态">
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    反选
                  </Button>
                  <Button size="sm" variant="ghost" onClick={selectAll} title="全部选中">
                    全选
                  </Button>
                  <Button size="sm" variant="ghost" onClick={selectNone} title="全部取消">
                    全不选
                  </Button>
                </div>
                {regexError && (
                  <div className="text-xs text-[var(--color-danger]">{regexError}</div>
                )}
              </div>
              <ul className="divide-y divide-[var(--color-border] max-h-[40vh] overflow-auto">
                {fragments.map((seg) => {
                  const checked = selectedSet.has(seg.index);
                  return (
                  <li
                    key={seg.index}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-[var(--color-surface-dim]',
                      !checked && 'opacity-50',
                    )}
                    onClick={() => toggleSegment(seg.index)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSegment(seg.index)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 accent-[var(--color-primary] shrink-0"
                    />
                    <span className="font-mono text-[var(--color-text-muted] w-10 text-right">
                      #{seg.index}
                    </span>
                    {seg.encrypted && <KeyRound className="w-3 h-3 text-[var(--color-warning]" />}
                    <span className="flex-1 truncate font-mono" title={seg.url}>
                      {seg.url}
                    </span>
                    {seg.duration && (
                      <span className="text-[var(--color-text-muted]">
                        {seg.duration.toFixed(1)}s
                      </span>
                    )}
                  </li>
                  );
                })}
              </ul>
            </details>

            {/* 下载选项 */}
            <div className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings2 className="w-4 h-4" />
                下载选项
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5">
                  <span className="text-[var(--color-text-muted]">线程</span>
                  <input
                    type="number"
                    min={1}
                    max={256}
                    value={thread}
                    onChange={(e) => setThread(Math.max(1, Number(e.target.value)))}
                    className="w-14 px-1.5 py-0.5 border border-[var(--color-border] rounded bg-[var(--color-surface-dim]"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={skipDecrypt}
                    onChange={(e) => setSkipDecrypt(e.target.checked)}
                  />
                  跳过解密
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={dataPreprocessing}
                    onChange={(e) => setDataPreprocessing(e.target.checked)}
                  />
                  预处理(切 JPEG 头)
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={autoClose}
                    onChange={(e) => setAutoClose(e.target.checked)}
                  />
                  完成后关闭
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={streamingSave}
                    onChange={(e) => setStreamingSave(e.target.checked)}
                  />
                  流式落盘(大文件)
                </label>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--color-text-muted]">下载范围</span>
                <input
                  type="number"
                  min={1}
                  max={total}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(Number(e.target.value))}
                  className="w-16 px-1.5 py-0.5 border border-[var(--color-border] rounded bg-[var(--color-surface-dim]"
                />
                <span className="text-[var(--color-text-muted]">-</span>
                <input
                  type="number"
                  min={1}
                  max={total}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(Number(e.target.value))}
                  className="w-16 px-1.5 py-0.5 border border-[var(--color-border] rounded bg-[var(--color-surface-dim]"
                />
                <span className="text-[var(--color-text-muted]">(1 - {total})</span>
              </div>
            </div>

            {/* 自定义 Key / IV(还原原 m3u8.html #openKeyBox) */}
            <div className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] p-3 space-y-3">
              <button
                type="button"
                onClick={() => setShowKeyForm((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium w-full text-left"
              >
                <KeyRound className="w-4 h-4" />
                自定义 Key / IV
                <span className="ml-auto text-xs text-[var(--color-text-muted]">
                  {showKeyForm ? '收起' : '展开'}
                </span>
              </button>
              {showKeyForm && (
                <div className="space-y-2">
                  <div className="text-xs text-[var(--color-text-muted]">
                    支持 hex(32 位) / base64(24 位带 ==) 格式的 Key;IV 任意字符串。下载前应用。
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted]">Key</label>
                    <input
                      type="text"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="如 a1b2c3... (32 位 hex) 或 base64 字符串"
                      className="w-full mt-1 px-2 py-1.5 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface-dim] text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted]">IV</label>
                    <input
                      type="text"
                      value={customIV}
                      onChange={(e) => setCustomIV(e.target.value)}
                      placeholder="IV 字符串(可选)"
                      className="w-full mt-1 px-2 py-1.5 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface-dim] text-sm font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setCustomKey(''); setCustomIV(''); }}
                    >
                      清空
                    </Button>
                    {(customKey || customIV) && (
                      <span className="text-xs text-[var(--color-success]">
                        已设置,下载时应用
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 进度 */}
            {status !== 'idle' && (
              <div className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {status === 'downloading' && '下载中...'}
                    {status === 'done' && (
                      <span className="flex items-center gap-1 text-[var(--color-success]">
                        <CheckCircle2 className="w-4 h-4" /> 完成
                      </span>
                    )}
                    {status === 'error' && (
                      <span className="text-[var(--color-danger]">错误</span>
                    )}
                  </span>
                  <span className="font-mono text-xs">
                    {success}/{total} | {byteToSize(buffersize)} | {secToTime(duration)}
                  </span>
                </div>
                <div className="h-2 bg-[var(--color-surface-dim] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {currentFragment && status === 'downloading' && (
                  <div className="text-xs text-[var(--color-text-muted] truncate font-mono">
                    {currentFragment}
                  </div>
                )}
                {errorCount > 0 && (
                  <div className="text-xs text-[var(--color-danger]">失败 {errorCount} 项</div>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 flex-wrap">
              {status !== 'downloading' ? (
                <Button
                  variant="primary"
                  onClick={() => void startDownload()}
                  disabled={loading || !fragments.length}
                >
                  <Download className="w-4 h-4" />
                  合并下载
                </Button>
              ) : (
                <Button variant="danger" onClick={stopDownload}>
                  <StopCircle className="w-4 h-4" />
                  停止
                </Button>
              )}
              <Button
                variant="outline"
                onClick={invokeM3u8dl}
                disabled={!url || m3u8dlMode === 0}
                title={
                  m3u8dlMode === 0
                    ? '未启用,请到设置页开启 m3u8dl 协议'
                    : `调用本地 m3u8dl 程序 (模式 ${m3u8dlMode === 1 ? 'base64' : '原文'})`
                }
              >
                <Terminal className="w-4 h-4" />
                调用 m3u8dl
              </Button>
              {status !== 'downloading' && (
                <Button
                  variant="outline"
                  onClick={() => void startDownload('ffmpeg')}
                  disabled={loading || !fragments.length}
                  title="下载切片合并后发送到在线 ffmpeg 服务转码为 MP4(不保存本地)"
                >
                  <Wand2 className="w-4 h-4" />
                  在线 ffmpeg 合并
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setPhase('input');
                  setResult(null);
                  setFragments([]);
                  setStatus('idle');
                  // 重置 HLS 播放
                  hlsRef.current?.detachMedia();
                  setPlaying(false);
                  // 重置自定义 Key/IV
                  setShowKeyForm(false);
                  setCustomKey('');
                  setCustomIV('');
                }}
              >
                <Trash2 className="w-4 h-4" />
                重新解析
              </Button>
              <Button
                variant="outline"
                onClick={togglePlay}
                disabled={!url}
                title="使用 hls.js 在线播放预览"
              >
                <MonitorPlay className="w-4 h-4" />
                {playing ? '停止播放' : '在线播放'}
              </Button>
            </div>

            {/* HLS 在线播放 video(还原原 m3u8.html #video) */}
            {(playing || hlsError) && (
              <div className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <MonitorPlay className="w-4 h-4" />
                    在线播放预览
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      hlsRef.current?.detachMedia();
                      setPlaying(false);
                      setHlsError('');
                    }}
                    className="text-xs text-[var(--color-text-muted] hover:text-[var(--color-text]"
                  >
                    关闭
                  </button>
                </div>
                {hlsError && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--color-danger]/10 text-[var(--color-danger] text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {hlsError}
                  </div>
                )}
                <video
                  ref={videoRef}
                  key="m3u8-preview-video"
                  controls
                  playsInline
                  preload="auto"
                  className="w-full max-h-[60vh] bg-black rounded-[--radius-md]"
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/** 从 m3u8 url 提取文件名 */
function deriveFilename(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').pop();
    return seg ? seg.replace(/\.m3u8.*$/i, '') : '';
  } catch {
    return '';
  }
}
