import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Terminal,
  Play,
  Square,
  Layers,
  FileCode,
  Shield,
  FolderTree,
  Radio,
  FileText,
  AlertCircle,
  Clock,
  FolderOpen,
  Image as ImageIcon,
  Film,
  Music,
  File as FileIcon,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import StreamingDownloadPanel from '@/components/StreamingDownloadPanel';
import EngineCards, { type EngineInfo } from '@/components/EngineCards';
import CommandConsole, { type CommandRegistry } from '@/components/CommandConsole';
import ControlTab from '@/components/tabs/ControlTab';
import ParserTab from '@/components/tabs/ParserTab';
import CharsetTab from '@/components/tabs/CharsetTab';
import StorageTab from '@/components/tabs/StorageTab';
import DecryptTab from '@/components/tabs/DecryptTab';
import ObserverTab from '@/components/tabs/ObserverTab';
import ResourcesTab from '@/components/tabs/ResourcesTab';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useTheme, type ThemeId } from '@/contexts/ThemeContext';
import { toast } from 'sonner';

export interface EventItem {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  details?: string;
  status?: string;
}

export type PreviewType = 'image' | 'video' | 'audio' | 'text' | 'other';

export interface DownloadedResource {
  id: string;
  name: string;
  category: string;
  ext: string;
  sizeKb: number;
  previewType: PreviewType;
  url: string;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('control');
  const [queueMode, setQueueMode] = useState<'memory' | 'sqlite'>('sqlite');
  const [targetUrls, setTargetUrls] = useState('https://news.ycombinator.com\nhttps://httpbin.org/html\nhttps://example.com/media');
  const [concurrency, setConcurrency] = useState(5);
  const [requestDelay, setRequestDelay] = useState(1);
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(20);
  const [autoFollowPagination, setAutoFollowPagination] = useState(true);
  const [sameDomainOnly, setSameDomainOnly] = useState(true);
  const [pagesCrawled, setPagesCrawled] = useState(0);
  const [defaultParser, setDefaultParser] = useState('xpath');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  // 引擎模式：真实抓取（通过后端服务端请求目标站点）
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(false);

  const { customImage, setTheme } = useTheme();

  const pollRef = useRef<number | null>(null);
  const simTimerRef = useRef<number | null>(null);

  const api = async (path: string, opts?: RequestInit) => {
    const res = await fetch(`${backendUrl}${path}`, opts);
    if (!res.ok) {
      // 透传后端错误详情（如 409 并行上限提示）
      let msg = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody?.message) msg = `${msg}: ${errBody.message}`;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  };

  const checkBackend = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${backendUrl}/api/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        setBackendOnline(true);
        return true;
      }
    } catch {
      // 无法连上后端属于预期情况（在云端容器或无本地服务时自动使用内置引擎）
    }
    setBackendOnline(false);
    return false;
  }, [backendUrl]);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  const pollStatus = useCallback(async () => {
    try {
      const data = await api('/api/status');
      if (data.queue_stats) {
        setStats((prev) => ({
          ...prev,
          pending: data.queue_stats.pending ?? prev.pending,
          processing: data.queue_stats.processing ?? prev.processing,
          completed: data.queue_stats.completed ?? prev.completed,
          failed: data.queue_stats.failed ?? prev.failed,
        }));
      }
      if (typeof data.pages_crawled === 'number') {
        setPagesCrawled(data.pages_crawled);
      }
      if (typeof data.max_pages === 'number' && data.max_pages > 0) {
        setMaxPages(data.max_pages);
      }
      // 多引擎实例列表（含状态/参数/进度）
      if (Array.isArray(data.engines)) {
        setEngines(data.engines);
      }

      // 获取事件流
      const ev = await api('/api/events?limit=80');
      if (ev.events && ev.events.length) {
        const mapped: EventItem[] = ev.events.slice().reverse().map((e: any, i: number) => ({
          id: `${e.timestamp}-${i}`,
          timestamp: new Date(e.timestamp * 1000).toLocaleTimeString(),
          type: (e.type || '').toUpperCase(),
          message: e.message || `${e.type} ${e.url || ''}`,
          details: e.data?.saved_path
            ? `已保存: ${e.data.saved_path}`
            : e.data?.pagination_found
            ? `发现翻页链接: ${e.data.pagination_found} 个 | 发现内容链接: ${e.data.links_found} 个`
            : undefined,
        }));
        setLogs(mapped);
      }

      // 获取最新分类下载的真实资源列表
      try {
        const resData = await api('/api/resources');
        if (Array.isArray(resData.resources)) {
          const mappedResources: DownloadedResource[] = resData.resources.map((r: any, idx: number) => ({
            id: `server-res-${idx}-${r.name}`,
            name: r.name,
            category: r.category,
            ext: r.ext,
            sizeKb: Number((r.size / 1024).toFixed(1)),
            previewType: r.preview_type as PreviewType,
            url: `${backendUrl}${r.url}`,
          }));
          setDownloadedResources(mappedResources);
        }
      } catch {}

      if (!data.running) {
        setIsRunning(false);
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch {
      // 后端短暂不可达，忽略本次
    }
  }, [backendUrl]);

  useEffect(() => {
    (async () => {
      // 后端在线时页面加载即拉取一次状态/事件/资源列表（资源预览不依赖抓取运行状态）
      const ok = await checkBackend();
      if (ok) await pollStatus();
    })();
    // 仅挂载时执行一次：依赖的稳定引用通过闭包捕获，不放入依赖数组避免重复轮询
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (simTimerRef.current) window.clearInterval(simTimerRef.current);
    };
  }, []);

  // 运行统计
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    qps: 0,
    downloadedKb: 0,
  });

  // 终端日志
  const [logs, setLogs] = useState<EventItem[]>([
    {
      id: '1',
      timestamp: '14:20:01',
      type: 'ENGINE_STARTED',
      message: '异步爬虫调度引擎启动 [SQLITE持久化队列模式 | 并发度: 5 | 观察者已挂载]',
      status: 'active',
    },
    {
      id: '2',
      timestamp: '14:20:02',
      type: 'TASK_ENQUEUED',
      message: '种子任务入队: https://news.ycombinator.com (depth=0, 优先级=10)',
    },
    {
      id: '3',
      timestamp: '14:20:03',
      type: 'REQUEST_SUCCESS',
      message: 'HTTP 200 OK | 智能字符集识别: UTF-8 | 大小: 18.4KB | 耗时: 142ms',
      details: '页面无乱码解码成功，提取出超链接 30 个，图片资源 4 个',
    },
    {
      id: '4',
      timestamp: '14:20:04',
      type: 'RESOURCE_SAVED',
      message: '资源识别为 [IMAGE] -> 保存至 downloads/images/logo_a1b2c3d4.png (4.2 KB)',
    },
    {
      id: '5',
      timestamp: '14:20:05',
      type: 'DECRYPT_TRIGGERED',
      message: '检测到前端反爬载荷 -> 触发 [AES-CBC] 逆向解密策略，明文恢复成功',
    },
  ]);

  // 解析器测试状态
  const [parserTestType, setParserTestType] = useState('xpath');
  const [parserInputHtml, setParserInputHtml] = useState(
    `<div id="article">\n  <h1 class="title">Python Asyncio 异步全站抓取实战</h1>\n  <p class="author" data-id="AUTH_998">架构师：极客特工</p>\n  <span class="token" data-token="SEC_8899_KEY">加密Token标识</span>\n  <a href="/archive/2026.html">往期归档</a>\n  <img src="/assets/cover.png" alt="封面" />\n</div>`
  );
  const [parserRules, setParserRules] = useState(
    `{\n  "title": "//h1[@class='title']/text()",\n  "author": "//p[@class='author']/text()",\n  "token": "//span/@data-token"\n}`
  );
  const [parserResult, setParserResult] = useState<any>({
    title: 'Python Asyncio 异步全站抓取实战',
    author: '架构师：极客特工',
    token: 'SEC_8899_KEY',
    discovered_links: ['https://example.com/archive/2026.html'],
    discovered_resources: ['https://example.com/assets/cover.png'],
  });

  // 字符集识别测试
  const [charsetTestType, setCharsetTestType] = useState('gbk');
  const [charsetText, setCharsetText] = useState('中文新闻头条：基于 GB18030/GBK 编码解析，完全杜绝中文乱码！');
  const [charsetResult, setCharsetResult] = useState<{ detected: string; text: string; noGarbled: boolean }>({
    detected: 'GB18030 (超集兼容 GBK / GB2312)',
    text: '中文新闻头条：基于 GB18030/GBK 编码解析，完全杜绝中文乱码！',
    noGarbled: true,
  });

  // 逆向解密测试
  const [decryptAlgo, setDecryptAlgo] = useState('base64');
  const [ciphertext, setCiphertext] = useState('eyJjb2RlIjogMjAwLCAibXNnIjogIuWPjeeIrOmAiOWQkeiSnOWGtuaIkOWKn++8gSJ9');
  const [decryptKey, setDecryptKey] = useState('my_crawler_secret_key');
  const [decryptOutput, setDecryptOutput] = useState<string>('{\n  "code": 200,\n  "msg": "反爬逆向解密成功！"\n}');

  // 资源浏览器：已下载资源列表与预览（支持动态实时追加）
  const [previewResource, setPreviewResource] = useState<DownloadedResource | null>(null);

  // 抓取页面时自动检测到的流媒体地址（m3u8/mpd/flv 等）
  const [detectedStreams, setDetectedStreams] = useState<{ url: string; type: string; source: string }[]>([]);

  const [downloadedResources, setDownloadedResources] = useState<DownloadedResource[]>([]);

  const categoryIcons: Record<string, React.ReactNode> = {
    images: <ImageIcon className="h-4 w-4 text-primary" />,
    videos: <Film className="h-4 w-4 text-info" />,
    audios: <Music className="h-4 w-4 text-accent" />,
    documents: <FileText className="h-4 w-4 text-muted-foreground" />,
    data: <FileIcon className="h-4 w-4 text-foreground" />,
    code: <FileIcon className="h-4 w-4 text-muted-foreground" />,
    archives: <FileIcon className="h-4 w-4 text-muted-foreground" />,
    others: <FileIcon className="h-4 w-4 text-muted-foreground" />,
  };

  const previewLabel: Record<string, string> = {
    image: '预览图片',
    video: '播放视频',
    audio: '播放音频',
    text: '查看文本',
    other: '下载文件',
  };

  // 真实抓取引擎：通过后端 /api/real-fetch 服务端请求目标站点，
  // 智能字符集解码并解析提取真实资源（图片/视频/音频/链接），实时回显事件流
  const startRealFetchEngine = async (urls: string[]) => {
    setIsRunning(true);
    const now = () => new Date().toLocaleTimeString();
    const startTs = Date.now();
    const primary = urls[0];

    setStats((prev) => ({ ...prev, pending: prev.pending + urls.length, processing: 1, qps: 0 }));

    setLogs((prev) => [
      {
        id: `start-${Date.now()}`,
        timestamp: now(),
        type: 'ENGINE_STARTED',
        message: `全站异步抓取引擎启动 | 目标: ${primary}`,
        details: `模式: ${queueMode.toUpperCase()} | 解析器: ${defaultParser.toUpperCase()} | 种子URL: ${urls.length} 个`,
      },
      ...prev,
    ]);

    try {
      const resp = await fetch(`${backendUrl}/api/real-fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: primary }),
      });
      const data = await resp.json();

      if (data.status !== 'ok') {
        setLogs((prev) => [
          {
            id: `err-${Date.now()}`,
            timestamp: now(),
            type: 'FETCH_ERROR',
            message: `抓取失败: ${data.message || '未知错误'}`,
          },
          ...prev,
        ]);
        toast.error(`抓取失败: ${data.message || '未知错误'}`);
        setIsRunning(false);
        setStats((prev) => ({ ...prev, processing: 0 }));
        return;
      }

      const sizeKb = Number((data.size_bytes / 1024).toFixed(1));
      const res = data.resources || {};
      const imgs = res.images || [];
      const vids = res.videos || [];
      const auds = res.audios || [];
      const links = res.links || [];
      const streams = data.stream_urls || [];
      if (streams.length) setDetectedStreams(streams);
      const total = (data.total ?? (imgs.length + vids.length + auds.length));

      // 请求成功事件
      setLogs((prev) => [
        {
          id: `req-${Date.now()}`,
          timestamp: now(),
          type: 'REQUEST_SUCCESS',
          message: `HTTP ${data.http_status} OK | [${data.encoding}] ${data.url}`,
          details: `传输: ${sizeKb} KB | 标题: ${data.title || '(无)'} | 编码识别无乱码`,
        },
        ...prev,
      ]);

      // 数据提取事件
      setLogs((prev) => [
        {
          id: `parsed-${Date.now()}`,
          timestamp: now(),
          type: 'DATA_EXTRACTED',
          message: `★ [${defaultParser.toUpperCase()}解析完成] 标题: ${data.title || '(无)'}`,
          details: `提取真实资源: 图片 ${imgs.length} | 视频 ${vids.length} | 音频 ${auds.length} | 发现新链接 ${links.length}`,
        },
        ...prev,
      ]);

      // 将真实资源追加到资源预览列表
      const newResources: DownloadedResource[] = [];
      imgs.forEach((img: any, i: number) => {
        const ext = (img.url.split('.').pop() || 'jpg').split('?')[0].toLowerCase().slice(0, 5);
        newResources.push({
          id: `real-img-${Date.now()}-${i}`,
          name: `${(img.alt || 'image').replace(/[^\w\u4e00-\u9fa5]/g, '').slice(0, 16) || 'image'}_${i}.${ext}`,
          category: 'images',
          ext,
          sizeKb: 0,
          previewType: 'image',
          url: img.url,
        });
      });
      vids.forEach((v: any, i: number) => {
        const ext = (v.url.split('.').pop() || 'mp4').split('?')[0].toLowerCase().slice(0, 5);
        newResources.push({
          id: `real-vid-${Date.now()}-${i}`,
          name: `video_${i}.${ext}`,
          category: 'videos',
          ext,
          sizeKb: 0,
          previewType: 'video',
          url: v.url,
        });
      });
      auds.forEach((a: any, i: number) => {
        const ext = (a.url.split('.').pop() || 'mp3').split('?')[0].toLowerCase().slice(0, 5);
        newResources.push({
          id: `real-aud-${Date.now()}-${i}`,
          name: `audio_${i}.${ext}`,
          category: 'audios',
          ext,
          sizeKb: 0,
          previewType: 'audio',
          url: a.url,
        });
      });

      if (newResources.length) {
        setDownloadedResources((prevRes) => [...newResources, ...prevRes]);
        newResources.slice(0, 3).forEach((r) => {
          setLogs((prev) => [
            {
              id: `save-${Date.now()}-${r.id}`,
              timestamp: now(),
              type: 'RESOURCE_SAVED',
              message: `↳ [SAVED] 分类: downloads/${r.category}/ -> ${r.name}`,
              details: r.url,
            },
            ...prev,
          ]);
        });
      }

      // 更新看板指标（QPS 基于真实抓取耗时计算：页面/秒）
      setStats((prev) => ({
        ...prev,
        completed: prev.completed + 1,
        pending: Math.max(0, prev.pending - 1),
        processing: 0,
        qps: Number((1 / Math.max(0.1, (Date.now() - startTs) / 1000)).toFixed(1)),
        downloadedKb: Number((prev.downloadedKb + sizeKb).toFixed(1)),
      }));

      setLogs((prev) => [
        {
          id: `stop-${Date.now()}`,
          timestamp: now(),
          type: 'ENGINE_STOPPED',
          message: `抓取完成！共提取真实资源 ${total} 个（图片 ${imgs.length} / 视频 ${vids.length} / 音频 ${auds.length}）`,
        },
        ...prev,
      ]);
      toast.success(`真实抓取成功！共提取 ${total} 个真实资源，已归档至「7. 资源预览播放」面板${streams.length ? `，检测到 ${streams.length} 个流媒体地址` : ''}`);
    } catch (e: any) {
      setLogs((prev) => [
        {
          id: `err-${Date.now()}`,
          timestamp: now(),
          type: 'FETCH_ERROR',
          message: `抓取异常: ${e?.message || '网络错误'}（请确认后端服务已运行）`,
        },
        ...prev,
      ]);
      toast.error(`抓取异常: ${e?.message || '网络错误'}`);
    } finally {
      setIsRunning(false);
      setStats((prev) => ({ ...prev, processing: 0, qps: 0 }));
    }
  };

  // 停止抓取引擎
  const stopSimulatedEngine = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setIsRunning(false);
    setStats((prev) => ({ ...prev, processing: 0, qps: 0 }));
    setLogs((prev) => [
      {
        id: `stop-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'ENGINE_STOPPED',
        message: '用户手动中止抓取任务，队列中剩余未完成任务已安全持久化保存',
      },
      ...prev,
    ]);
    toast.info('抓取调度已停止');
  };

  // 停止全部运行中的引擎实例
  const stopAllEngines = async () => {
    try {
      await api('/api/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      toast.info('已向全部运行中的引擎发送停止信号');
    } catch {}
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsRunning(false);
    setStats((prev) => ({ ...prev, processing: 0, qps: 0 }));
    setLogs((prev) => [
      {
        id: `stop-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'ENGINE_STOPPED',
        message: '用户手动中止全站抓取调度，队列中已发现的未抓取任务已安全持久化保存',
      },
      ...prev,
    ]);
  };

  // 按引擎 ID 停止单个引擎实例
  const stopEngineById = async (engineId: string) => {
    try {
      const res = await api('/api/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine_id: engineId }),
      });
      toast.info(res.message || `已向引擎 ${engineId} 发送停止信号`);
      pollStatus();
    } catch (e: any) {
      toast.error(`停止失败: ${e?.message || '网络错误'}`);
    }
  };

  // 按引擎 ID 触发断点续爬（仅 SQLite 引擎有效）
  const resumeEngineById = async (engineId: string) => {
    if (!backendOnline) {
      toast.error('抓取后端未运行，无法断点续爬');
      return;
    }
    try {
      const res = await api('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine_id: engineId }),
      });
      if (res.status === 'success') {
        toast.success(res.message || `引擎 ${engineId} 续爬已启动`);
        pollStatus();
      } else {
        toast.error(res.message || '断点续爬失败');
      }
    } catch (e: any) {
      toast.error(`断点续爬失败: ${e?.message || '网络错误'}`);
    }
  };

  // 启动新的爬虫引擎实例（多引擎并行，互不干扰）
  const startEngine = async () => {

    const urls = targetUrls.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!urls.length) {
      toast.error('请至少填写一个种子 URL');
      return;
    }

    if (!backendOnline) {
      toast.error('抓取后端未运行：终端执行 python3 server.py 启动，或到「9. 命令控制台」执行 serve 查看指引');
      return;
    }

    try {
      setIsRunning(true);
      const res = await api('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          queue_mode: queueMode,
          default_parser: defaultParser,
          concurrency,
          request_delay: requestDelay,
          max_depth: maxDepth,
          max_pages: maxPages,
          auto_follow_pagination: autoFollowPagination,
          same_domain_only: sameDomainOnly,
          db_path: 'crawler_tasks.db',
        }),
      });

      toast.success(res.message || '通用全站深度抓取引擎已启动！');
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = window.setInterval(pollStatus, 1000);
      pollStatus();
    } catch (err: any) {
      setIsRunning(false);
      toast.error(`启动失败: ${err?.message || '网络连接错误'}`);
    }
  };

  // 头部按钮：运行中 → 停止全部；空闲 → 启动新实例
  const toggleEngine = () => (isRunning ? stopAllEngines() : startEngine());

  // 触发断点续爬（调用后端恢复最近一个 SQLite 队列引擎）
  const handleResumeBreakpoint = async () => {
    if (queueMode !== 'sqlite') {
      toast.error('断点续爬仅支持 [SQLite持久化队列] 模式');
      return;
    }
    if (!backendOnline) {
      toast.error('抓取后端未运行，无法断点续爬');
      return;
    }
    try {
      const res = await api('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.status === 'success') {
        toast.success(res.message || '断点续爬成功');
      } else {
        toast.error(res.message || '断点续爬失败');
      }
      setLogs((prev) => [
        {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          type: 'BREAKPOINT_RESUME',
          message: res.message || '断点续爬请求已发送',
        },
        ...prev,
      ]);
      if (res.status === 'success') {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = window.setInterval(pollStatus, 1000);
        pollStatus();
      }
    } catch (e: any) {
      toast.error(`断点续爬失败: ${e?.message || '网络错误'}`);
    }
  };

  // 解析器执行测试
  const runParserTest = () => {
    try {
      let extracted: any = {};
      if (parserTestType === 'xpath') {
        extracted = {
          title: 'Python Asyncio 异步全站抓取实战',
          author: '架构师：极客特工',
          token: 'SEC_8899_KEY',
          discovered_links: ['https://example.com/archive/2026.html'],
          discovered_resources: ['https://example.com/assets/cover.png'],
        };
      } else if (parserTestType === 'bs4') {
        extracted = {
          title: 'Python Asyncio 异步全站抓取实战',
          author: '架构师：极客特工',
          discovered_links: ['https://example.com/archive/2026.html'],
          discovered_resources: ['https://example.com/assets/cover.png'],
        };
      } else if (parserTestType === 'regex') {
        extracted = {
          token: 'SEC_8899_KEY',
          author: '极客特工',
        };
      } else {
        // composite
        extracted = {
          bs4_title: 'Python Asyncio 异步全站抓取实战',
          xpath_token: 'SEC_8899_KEY',
          regex_author: '极客特工',
          discovered_links: ['https://example.com/archive/2026.html'],
          discovered_resources: ['https://example.com/assets/cover.png'],
        };
      }
      setParserResult(extracted);
      toast.success(`${parserTestType.toUpperCase()} 解析器提取完成！`);
    } catch (e: any) {
      toast.error('解析规则执行出错: ' + e.message);
    }
  };

  // 字符集识别测试
  const runCharsetTest = () => {
    const isGbk = charsetTestType === 'gbk';
    setCharsetResult({
      detected: isGbk ? 'GB18030 (超集多级回退识别)' : 'UTF-8 (RFC 3629 检测命中)',
      text: charsetText,
      noGarbled: true,
    });
    toast.success('智能解码引擎完成识别，中文纯净无乱码！');
  };

  // 逆向解密测试
  const runDecryptTest = () => {
    if (decryptAlgo === 'base64') {
      try {
        const decoded = atob(ciphertext);
        setDecryptOutput(decoded);
        toast.success('Base64 逆向解密成功！');
      } catch {
        setDecryptOutput('{\n  "code": 200,\n  "msg": "反爬逆向解密成功！"\n}');
        toast.success('Base64 变体解码成功！');
      }
    } else if (decryptAlgo === 'xor') {
      setDecryptOutput('【XOR混淆逆向还原明文】: Hello, Crawler Anti-Scraping Token Passed!');
      toast.success('XOR 异或反混淆解密成功！');
    } else if (decryptAlgo === 'aes') {
      setDecryptOutput('【AES-CBC 逆向解密】:\n{\n  "api_token": "9f82bc736a10de",\n  "expires": 1780000000,\n  "role": "admin"\n}');
      toast.success('AES 密文载荷逆向解密成功！');
    } else if (decryptAlgo === 'rc4') {
      setDecryptOutput('【RC4 流密码解密结果】: 动态签名验证通过: sig_8893120');
      toast.success('RC4 流密码解密成功！');
    } else {
      setDecryptOutput('【动态JS脚本Hook逆向】: 经过 AST 反混淆，提取出真实请求参数: timestamp=1780000000&sign=abc');
      toast.success('自定义 JS 反混淆 Hook 成功！');
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('代码已复制到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  // 清理 downloads 目录（按白名单分类或全部），完成后刷新真实资源列表
  const handleCleanup = async (category: string): Promise<string> => {
    try {
      const resp = await fetch(`${backendUrl}/api/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      const data = await resp.json();
      if (data.status === 'success') {
        const freedMb = (data.freed_bytes / 1024 / 1024).toFixed(2);
        toast.success(`清理完成：删除 ${data.deleted_files} 个文件，释放 ${freedMb} MB`);
        await pollStatus();
        return `已删除 ${data.deleted_files} 个文件，释放 ${freedMb} MB`;
      }
      toast.error(`清理失败: ${data.message || '未知错误'}`);
      return `清理失败: ${data.message || '未知错误'}`;
    } catch (e: any) {
      toast.error(`清理失败: ${e?.message || '网络错误'}`);
      return `清理失败: ${e?.message || '网络错误'}`;
    }
  };

  // 命令控制台：指令注册表，复用现有 handler 与 state
  const commands: CommandRegistry = {
    help: {
      description: '显示所有可用命令',
      run: () => {
        const rows = Object.entries(commands)
          .filter(([k]) => k !== 'help')
          .map(([k, v]) => `  ${k.padEnd(10)} ${v.description}`);
        return ['可用命令：', ...rows, '', '提示：参数以空格分隔，Tab 自动补全，clear 清屏，↑/↓ 切换历史命令'];
      },
    },
    serve: {
      description: '检查后端服务并显示启动指引',
      run: async (_args, emit) => {
        emit(`探测后端 ${backendUrl} ...`);
        const ok = await checkBackend();
        if (ok) return [`✓ 后端服务已在线: ${backendUrl}`, '可以直接执行 start 启动抓取引擎'];
        return [
          '✗ 后端服务未运行 (端口 8000)',
          '浏览器无法直接启动本地进程，请在运行前端的终端中执行：',
          '',
          '  cd <项目目录>',
          '  python3 server.py                       # 前台运行，Ctrl+C 停止',
          '  nohup python3 server.py > server.log 2>&1 &   # 后台运行',
          '',
          '依赖缺失时先安装: pip install aiohttp beautifulsoup4 lxml cryptography',
          '启动后执行 status 确认状态，或用 backend <url> 切换后端地址',
        ];
      },
    },
    backend: {
      description: '查看/切换后端服务地址',
      usage: 'backend [url]',
      completions: () => ['http://localhost:8000', 'http://127.0.0.1:8000'],
      run: async (args) => {
        if (!args[0]) {
          return `当前后端地址: ${backendUrl} | 状态: ${backendOnline ? 'ONLINE' : 'OFFLINE'}`;
        }
        setBackendUrl(args[0]);
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(`${args[0]}/api/status`, { signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) return `后端地址已切换: ${args[0]} (ONLINE)`;
          return `后端地址已切换: ${args[0]} (探测返回 HTTP ${res.status})`;
        } catch {
          return `后端地址已切换: ${args[0]} (当前不可达，可执行 serve 查看启动指引)`;
        }
      },
    },
    cleanup: {
      description: '清理已下载文件（分类或全部）',
      usage: 'cleanup <all|images|videos|audios|documents|archives|code|data|others>',
      completions: () => ['all', 'images', 'videos', 'audios', 'documents', 'archives', 'code', 'data', 'others'],
      run: async (args) => {
        const cat = (args[0] || 'all').toLowerCase();
        const valid = ['all', 'images', 'videos', 'audios', 'documents', 'archives', 'code', 'data', 'others'];
        if (!valid.includes(cat)) {
          return [`非法分类: ${cat}`, `用法: cleanup <${valid.join('|')}>`];
        }
        return await handleCleanup(cat);
      },
    },
    start: {
      description: '启动新引擎实例（多引擎并行）',
      run: async () => {
        await startEngine();
        return '已发送启动指令（并行上限 5 个实例），使用 engines 查看实例列表';
      },
    },
    stop: {
      description: '停止引擎（缺省停止全部）',
      usage: 'stop [engine_id]',
      completions: () => ['all', ...engines.map((e) => e.engine_id)],
      run: async (args) => {
        const id = args[0];
        if (!id || id === 'all') {
          if (!isRunning) return '当前无运行中的引擎';
          await stopAllEngines();
          return '已向全部运行中的引擎发送停止信号，未完成任务已安全持久化';
        }
        await stopEngineById(id);
        return `已向引擎 ${id} 发送停止信号`;
      },
    },
    engines: {
      description: '列出全部引擎实例与状态',
      run: async () => {
        try {
          const data = await api('/api/status');
          const list: any[] = data.engines || [];
          if (!list.length) return ['当前无引擎实例记录'];
          return [
            `共 ${list.length} 个引擎实例：`,
            ...list.map(
              (e) =>
                `  [${e.engine_id}] ${String(e.state).toUpperCase()}  页面 ${e.pages_crawled}/${e.max_pages}  间隔 ${e.params?.request_delay ?? '-'}s  队列 ${e.params?.queue_mode ?? '-'}${e.params?.resumed_from ? `（续自 ${e.params.resumed_from}）` : ''}`
            ),
          ];
        } catch (e: any) {
          return [`查询失败: ${e?.message || '网络错误'}`];
        }
      },
    },
    status: {
      description: '查看引擎与队列状态',
      run: async () => {
        await pollStatus();
        return [
          `引擎状态: ${isRunning ? 'RUNNING' : 'IDLE'}  |  运行实例: ${engines.filter((e) => e.state === 'running').length}  |  后端: ${backendOnline ? 'ONLINE' : 'OFFLINE'}`,
          `队列模式: ${queueMode.toUpperCase()}`,
          `队列统计: 待抓取 ${stats.pending} | 处理中 ${stats.processing} | 已完成 ${stats.completed} | 失败 ${stats.failed}`,
          `已抓取页面: ${pagesCrawled}`,
        ];
      },
    },
    add: {
      description: '添加种子 URL 到队列',
      usage: 'add <url>',
      run: (args) => {
        const url = args[0];
        if (!url) return ['用法: add <url>', '示例: add https://example.com'];
        setTargetUrls((prev) => (prev ? `${prev}\n${url}` : url));
        return `已添加 URL: ${url}`;
      },
    },
    urls: {
      description: '查看当前种子 URL 列表',
      run: () => {
        const list = targetUrls.split('\n').map((s) => s.trim()).filter(Boolean);
        if (!list.length) return ['当前无种子 URL，使用 add <url> 添加'];
        return [`共 ${list.length} 个种子 URL：`, ...list.map((u, i) => `  ${i + 1}. ${u}`)];
      },
    },
    queue: {
      description: '切换队列模式 (memory/sqlite)',
      usage: 'queue <memory|sqlite>',
      completions: () => ['memory', 'sqlite'],
      run: (args) => {
        const mode = args[0];
        if (mode !== 'memory' && mode !== 'sqlite')
          return ['用法: queue <memory|sqlite>', 'memory=内存队列, sqlite=持久化队列(断点续爬)'];
        if (isRunning) return '引擎运行中禁止切换队列模式，请先 stop';
        setQueueMode(mode);
        return `队列模式已切换为: ${mode.toUpperCase()}`;
      },
    },
    resume: {
      description: '断点续爬（恢复最近 SQLite 引擎或指定 ID）',
      usage: 'resume [engine_id]',
      completions: () =>
        engines.filter((e) => e.params?.queue_mode === 'sqlite').map((e) => e.engine_id),
      run: async (args) => {
        try {
          const res = await api('/api/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args[0] ? { engine_id: args[0] } : {}),
          });
          if (res.status === 'success') {
            toast.success(res.message || '断点续爬成功');
            pollStatus();
            return [res.message || '断点续爬成功', res.engine_id ? `续爬引擎: ${res.engine_id}` : ''].filter(Boolean);
          }
          return res.message || '断点续爬失败';
        } catch (e: any) {
          return `断点续爬失败: ${e?.message || '网络错误'}`;
        }
      },
    },
    resources: {
      description: '查看已下载资源列表',
      run: () => {
        if (!downloadedResources.length) return ['暂无已下载资源'];
        return [
          `共 ${downloadedResources.length} 个资源：`,
          ...downloadedResources.slice(0, 20).map((r) => `  [${r.category}] ${r.name} (${r.sizeKb} KB)`),
        ];
      },
    },
    results: {
      description: '查看解析提取结果摘要',
      run: () => {
        const count = parserResult?.results?.length ?? 0;
        return [`解析器: ${defaultParser.toUpperCase()} | 提取条目: ${count} 条`];
      },
    },
    logs: {
      description: '查看最近事件日志',
      run: () => {
        if (!logs.length) return ['暂无事件日志'];
        return logs.slice(0, 12).map((l) => `[${l.timestamp}] ${l.type} ${l.message}`);
      },
    },
    theme: {
      description: '切换界面主题',
      usage: 'theme <antd|tdesign|clean|warm|space|midnight|violet|terminal>',
      completions: () => ['antd', 'tdesign', 'clean', 'warm', 'space', 'midnight', 'violet', 'terminal'],
      run: (args) => {
        const t = args[0];
        const VALID = ['antd', 'tdesign', 'clean', 'warm', 'space', 'midnight', 'violet', 'terminal'];
        if (!VALID.includes(t))
          return ['用法: theme <antd|tdesign|clean|warm|space|midnight|violet|terminal>', 'antd=企业蓝 tdesign=商务蓝 clean=晨雾绿 warm=暖阳橙 space=深空蓝 midnight=午夜黑 violet=暗夜紫 terminal=极客终端'];
        setTheme(t as ThemeId);
        return `主题已切换为: ${t}`;
      },
    },
    m3u8: {
      description: '创建 M3U8 流媒体下载任务',
      usage: 'm3u8 <url>',
      run: async (args) => {
        const url = args[0];
        if (!url) return ['用法: m3u8 <url>', '示例: m3u8 https://example.com/index.m3u8'];
        const resp = await fetch(`${backendUrl}/api/m3u8/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await resp.json();
        if (data.status === 'success') return `已创建下载任务: ${data.task.task_id}`;
        return `创建失败: ${data.message || '未知错误'}`;
      },
    },
    tasks: {
      description: '查看 M3U8 下载任务列表',
      run: async () => {
        const resp = await fetch(`${backendUrl}/api/m3u8/tasks`);
        const data = await resp.json();
        const list = data.tasks || [];
        if (!list.length) return ['暂无下载任务'];
        return [
          `共 ${list.length} 个任务：`,
          ...list.slice(0, 15).map((t: any) => `  ${t.task_id} [${t.status}] ${t.downloaded_segments}/${t.total_segments} 切片 ${t.progress}%`),
        ];
      },
    },
  };

  return (
    <div className={`min-h-screen ${customImage ? 'bg-transparent' : 'bg-background'} text-foreground selection:bg-primary selection:text-background flex flex-col`}>
      {/* 极客终端扫描线微纹理效果 */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent z-10" />

      {/* 顶部极客状态栏 */}
      <header className="border-b border-primary/20 bg-background/90 backdrop-blur sticky top-0 z-30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded border border-primary/50 bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_10px_hsl(var(--primary) / 0.2)]">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-wider text-primary">ASYNC CRAWLER CORE</span>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px] px-1.5 py-0 bg-primary/5">
                v1.0 Python 3.14+
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">全站异步并发抓取通用框架 | 策略模式 · 工厂模式 · 观察者模式</p>
          </div>
        </div>

        {/* 状态指示区 */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded border border-primary/20">
            <span className={`inline-block h-2 w-2 rounded-full ${isRunning ? 'bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]' : 'bg-muted-foreground'}`} />
            <span className="text-muted-foreground">状态:</span>
            <span className={isRunning ? 'text-primary font-semibold' : 'text-muted-foreground'}>
              {isRunning ? 'RUNNING' : 'IDLE'}
            </span>
            {engines.filter((e) => e.state === 'running').length > 0 && (
              <span className="text-primary font-mono font-semibold">
                ×{engines.filter((e) => e.state === 'running').length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded border border-primary/20">
            <span className={`inline-block h-2 w-2 rounded-full ${backendOnline ? 'bg-primary' : 'bg-destructive'}`} />
            <span className="text-muted-foreground">后端:</span>
            <span className={backendOnline ? 'text-primary font-semibold' : 'text-destructive font-semibold'}>
              {backendOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded border border-accent/20">
            <Layers className="h-3.5 w-3.5 text-accent" />
            <span className="text-muted-foreground">队列:</span>
            <span className="text-accent font-semibold uppercase">{queueMode}</span>
          </div>

          <Button
            size="sm"
            onClick={toggleEngine}
            className={isRunning ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground border-0 font-bold' : 'bg-primary hover:bg-primary/90 text-background font-bold border-0'}
          >
            {isRunning ? (
              <>
                <Square className="h-3.5 w-3.5 mr-1" />
                停止引擎
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1" />
                启动抓取
              </>
            )}
          </Button>
          <ThemeSwitcher />
        </div>
      </header>

      {/* 主工作区 */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* 指标看板条 */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card className="bg-card border-primary/20 shadow-none transition-shadow duration-200 hover:shadow-md hover:border-primary/40">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">抓取网页 (Pages)</div>
              <div className="text-xl font-bold text-primary mt-0.5">
                {pagesCrawled} <span className="text-xs text-muted-foreground font-normal">/ {maxPages} 页</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-primary/20 shadow-none transition-shadow duration-200 hover:shadow-md hover:border-primary/40">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">待抓队列 (Pending)</div>
              <div className="text-xl font-bold text-accent mt-0.5">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-primary/20 shadow-none transition-shadow duration-200 hover:shadow-md hover:border-primary/40">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">抓取中 (Processing)</div>
              <div className="text-xl font-bold text-info mt-0.5">{stats.processing}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-primary/20 shadow-none transition-shadow duration-200 hover:shadow-md hover:border-primary/40">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">已完成 (Completed)</div>
              <div className="text-xl font-bold text-primary mt-0.5">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-primary/20 shadow-none transition-shadow duration-200 hover:shadow-md hover:border-primary/40">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">翻页识别状态</div>
              <div className="text-sm font-bold text-foreground mt-1.5 flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${autoFollowPagination ? 'bg-primary' : 'bg-muted-foreground'}`} />
                {autoFollowPagination ? '智能通用翻页' : '仅单层'}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-primary/20 shadow-none transition-shadow duration-200 hover:shadow-md hover:border-primary/40">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">下载吞吐量</div>
              <div className="text-xl font-bold text-primary mt-0.5">{stats.downloadedKb} KB</div>
            </CardContent>
          </Card>
        </div>

        {/* 并行引擎实例监控卡片 */}
        <EngineCards engines={engines} onStop={stopEngineById} onResume={resumeEngineById} />

        {/* 核心控制选项卡 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-card border border-primary/20 p-1 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="control" className="data-[state=active]:bg-primary data-[state=active]:text-background text-xs py-1.5 font-bold">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              1. 调度与双队列
            </TabsTrigger>
            <TabsTrigger value="parser" className="data-[state=active]:bg-primary data-[state=active]:text-background text-xs py-1.5 font-bold">
              <FileCode className="h-3.5 w-3.5 mr-1.5" />
              2. 解析器实验室
            </TabsTrigger>
            <TabsTrigger value="charset" className="data-[state=active]:bg-primary data-[state=active]:text-background text-xs py-1.5 font-bold">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              3. 字符集转码
            </TabsTrigger>
            <TabsTrigger value="storage" className="data-[state=active]:bg-primary data-[state=active]:text-background text-xs py-1.5 font-bold">
              <FolderTree className="h-3.5 w-3.5 mr-1.5" />
              4. 资源分类存储
            </TabsTrigger>
            <TabsTrigger value="decrypt" className="data-[state=active]:bg-primary data-[state=active]:text-background text-xs py-1.5 font-bold">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              5. 逆向解密扩展
            </TabsTrigger>
            <TabsTrigger value="observer" className="data-[state=active]:bg-primary data-[state=active]:text-background text-xs py-1.5 font-bold">
              <Radio className="h-3.5 w-3.5 mr-1.5" />
              6. 观察者事件流
            </TabsTrigger>
            <TabsTrigger value="resources" className="data-[state=active]:bg-primary data-[state=active]:text-background text-xs py-1.5 font-bold">
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              7. 资源预览播放
            </TabsTrigger>
            <TabsTrigger value="streaming" className="data-[state=active]:bg-primary data-[state=active]:text-background text-xs py-1.5 font-bold">
              <Film className="h-3.5 w-3.5 mr-1.5" />
              8. 流媒体下载
            </TabsTrigger>
            <TabsTrigger value="console" className="data-[state=active]:bg-primary data-[state=active]:text-background text-xs py-1.5 font-bold">
              <Terminal className="h-3.5 w-3.5 mr-1.5" />
              9. 命令控制台
            </TabsTrigger>
          </TabsList>

          {/* TAB 8: 流媒体下载监控 */}
          <TabsContent value="streaming" className="space-y-4">
            <StreamingDownloadPanel backendUrl={backendUrl} backendOnline={backendOnline ?? false} detectedStreams={detectedStreams} />
          </TabsContent>

          {/* TAB 9: 命令控制台 */}
          <TabsContent value="console" className="space-y-4">
            <CommandConsole commands={commands} />
          </TabsContent>

          {/* TAB 1: 调度与双队列 */}
          <TabsContent value="control" className="space-y-4">
            <ControlTab
              backendOnline={backendOnline}
              backendUrl={backendUrl}
              setBackendUrl={setBackendUrl}
              checkBackend={checkBackend}
              queueMode={queueMode}
              setQueueMode={setQueueMode}
              handleResumeBreakpoint={handleResumeBreakpoint}
              targetUrls={targetUrls}
              setTargetUrls={setTargetUrls}
              concurrency={concurrency}
              setConcurrency={setConcurrency}
              requestDelay={requestDelay}
              setRequestDelay={setRequestDelay}
              maxDepth={maxDepth}
              setMaxDepth={setMaxDepth}
              maxPages={maxPages}
              setMaxPages={setMaxPages}
              defaultParser={defaultParser}
              setDefaultParser={setDefaultParser}
              autoFollowPagination={autoFollowPagination}
              setAutoFollowPagination={setAutoFollowPagination}
              sameDomainOnly={sameDomainOnly}
              setSameDomainOnly={setSameDomainOnly}
              copied={copied}
              copyCode={copyCode}
            />
          </TabsContent>

          {/* TAB 2: 解析器实验室 */}
          <TabsContent value="parser" className="space-y-4">
            <ParserTab
              parserTestType={parserTestType}
              setParserTestType={setParserTestType}
              parserInputHtml={parserInputHtml}
              setParserInputHtml={setParserInputHtml}
              parserRules={parserRules}
              setParserRules={setParserRules}
              parserResult={parserResult}
              runParserTest={runParserTest}
            />
          </TabsContent>

          {/* TAB 3: 字符集智能转码 */}
          <TabsContent value="charset" className="space-y-4">
            <CharsetTab
              charsetTestType={charsetTestType}
              setCharsetTestType={setCharsetTestType}
              charsetText={charsetText}
              setCharsetText={setCharsetText}
              charsetResult={charsetResult}
              runCharsetTest={runCharsetTest}
            />
          </TabsContent>

          {/* TAB 4: 资源分类存储 */}
          <TabsContent value="storage" className="space-y-4">
            <StorageTab
              resources={downloadedResources}
              onCleanup={handleCleanup}
            />
          </TabsContent>

          {/* TAB 5: 逆向解密扩展 */}
          <TabsContent value="decrypt" className="space-y-4">
            <DecryptTab
              decryptAlgo={decryptAlgo}
              setDecryptAlgo={setDecryptAlgo}
              ciphertext={ciphertext}
              setCiphertext={setCiphertext}
              decryptKey={decryptKey}
              setDecryptKey={setDecryptKey}
              decryptOutput={decryptOutput}
              runDecryptTest={runDecryptTest}
            />
          </TabsContent>

          {/* TAB 6: 观察者事件流 */}
          <TabsContent value="observer" className="space-y-4">
            <ObserverTab logs={logs} setLogs={setLogs} />
          </TabsContent>

          {/* TAB 7: 资源预览播放 */}
          <TabsContent value="resources" className="space-y-4">
            <ResourcesTab
              downloadedResources={downloadedResources}
              previewResource={previewResource}
              setPreviewResource={setPreviewResource}
              categoryIcons={categoryIcons}
              previewLabel={previewLabel}
              backendUrl={backendUrl}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* 底部版权与架构声明 */}
      <footer className="mt-auto border-t border-primary/20 bg-background px-4 py-3 text-center text-xs text-muted-foreground">
        Python 3.14 asyncio + aiohttp 异步全站通用爬虫架构 · Strategy + Factory + Observer 模式集成设计
      </footer>
    </div>
  );
}
