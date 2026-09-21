import { useState, useEffect, useRef } from 'react';
import {
  Youtube, Download, Loader2, CheckCircle2, AlertCircle,
  Search, Music, Film, FolderOpen, History, Captions, KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

interface Format {
  format_id: string;
  ext: string;
  resolution: string;
  fps: number;
  filesize: number;
}

interface Props {
  backendUrl: string;
  backendOnline: boolean;
}

export default function YtDlpPanel({ backendUrl, backendOnline }: Props) {
  const [url, setUrl] = useState('');
  const [outputDir, setOutputDir] = useState('downloads/videos');
  const [formatId, setFormatId] = useState('');
  const [audioOnly, setAudioOnly] = useState(false);
  const [writeSubs, setWriteSubs] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState('');
  const [history, setHistory] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('ytdlp_history') || '[]'); } catch { return []; }
  });
  const [hasCookie, setHasCookie] = useState(false);

  useEffect(() => {
    fetch(`${backendUrl}/api/ytdlp/cookie`).then(r => r.json()).then(d => setHasCookie(!!d.has_cookie)).catch(() => {});
  }, [backendUrl]);

  const uploadCookie = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    try {
      const res = await fetch(`${backendUrl}/api/ytdlp/cookie`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.status === 'success') {
        setHasCookie(true);
        toast.success('cookie 已上传');
      } else {
        toast.error(data.message || '上传失败');
      }
    } catch { toast.error('上传失败'); }
  };
  const [info, setInfo] = useState<any>(null);
  const [parsing, setParsing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'downloading' | 'completed' | 'failed'>('idle');
  const [result, setResult] = useState<any>(null);
  const pollRef = useRef<number | null>(null);

  const parseUrl = async () => {
    if (!url.trim()) {
      toast.error('请填写视频地址');
      return;
    }
    setParsing(true);
    setInfo(null);
    try {
      const res = await fetch(`${backendUrl}/api/ytdlp/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setInfo(data);
        if (data.formats?.length > 0) setFormatId(data.formats[0].format_id);
        toast.success('解析成功');
      } else {
        toast.error(data.message || '解析失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setParsing(false);
    }
  };

  const pushHistory = (item: any) => {
    const next = [item, ...history].slice(0, 20);
    setHistory(next);
    localStorage.setItem('ytdlp_history', JSON.stringify(next));
  };

  const openDir = async () => {
    try {
      await fetch(`${backendUrl}/api/open-dir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: outputDir.trim() }),
      });
    } catch { toast.error('打开失败'); }
  };

  const startBatch = async () => {
    const urls = batchUrls.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!urls.length) { toast.error('每行一个 URL'); return; }
    for (const u of urls) {
      try {
        await fetch(`${backendUrl}/api/ytdlp/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: u, output_dir: outputDir.trim(), write_subs: writeSubs }),
        });
      } catch { /* skip */ }
    }
    toast.success(`批量提交 ${urls.length} 个任务`);
    setBatchUrls('');
  };

  const start = async () => {
    if (!url.trim()) return;
    setStatus('downloading');
    setProgress(0);
    setResult(null);
    try {
      const res = await fetch(`${backendUrl}/api/ytdlp/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          output_dir: outputDir.trim(),
          format_id: formatId,
          audio_only: audioOnly,
          write_subs: writeSubs,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setTaskId(data.task_id);
        toast.success('已开始下载');
      } else {
        toast.error(data.message || '失败');
        setStatus('idle');
      }
    } catch {
      toast.error('网络错误');
      setStatus('idle');
    }
  };

  useEffect(() => {
    if (taskId && status === 'downloading') {
      pollRef.current = window.setInterval(async () => {
        try {
          const res = await fetch(`${backendUrl}/api/ytdlp/task/${taskId}`);
          const data = await res.json();
          if (data.task) {
            setProgress(data.task.progress || 0);
            if (data.task.status === 'completed') {
              setStatus('completed');
              setResult(data.task);
              pushHistory({ url, title: data.task.title || info?.title || '', filepath: data.task.filepath, time: Date.now() });
              toast.success('下载完成');
              if (pollRef.current) clearInterval(pollRef.current);
            } else if (data.task.status === 'failed') {
              setStatus('failed');
              setResult(data.task);
              toast.error('下载失败');
              if (pollRef.current) clearInterval(pollRef.current);
            }
          }
        } catch { /* ignore */ }
      }, 1500);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [taskId, status, backendUrl]);

  const fmtSize = (b: number) => b ? (b / 1024 / 1024).toFixed(1) + ' MB' : '';

  return (
    <Card className="bg-card border-primary/30 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          <Youtube className="h-4 w-4 text-primary" />
          yt-dlp 通用下载
          <span className="text-[10px] font-normal text-muted-foreground">抖音/快手/B站/YouTube/小红书</span>
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          粘贴地址 → 解析画质 → 选择 → 下载，无需命令行
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* URL 输入 */}
        <div className="flex items-center gap-2 text-xs">
          <Button size="sm" variant={batchMode ? 'default' : 'outline'} onClick={() => setBatchMode(!batchMode)} className="h-7 text-xs">
            {batchMode ? '单条模式' : '批量模式'}
          </Button>
          {!batchMode && (
            <Button size="sm" variant="outline" onClick={() => setWriteSubs(!writeSubs)} className={`h-7 text-xs ${writeSubs ? 'border-accent text-accent' : ''}`}>
              <Captions className="h-3.5 w-3.5 mr-1" /> 字幕
            </Button>
          )}
          <label className={`flex items-center gap-1 h-7 px-2 rounded border text-xs cursor-pointer ${hasCookie ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground hover:border-accent/50'}`}>
            <KeyRound className="h-3.5 w-3.5" />
            {hasCookie ? '已登录' : '上传 cookie'}
            <input type="file" accept=".txt" className="hidden" onChange={uploadCookie} />
          </label>
        </div>
        {batchMode ? (
          <textarea
            value={batchUrls}
            onChange={(e) => setBatchUrls(e.target.value)}
            placeholder={'https://v.douyin.com/xxx\nhttps://www.bilibili.com/video/xxx'}
            rows={4}
            className="w-full bg-secondary border-accent/30 text-xs font-mono rounded-md p-2.5 resize-y"
          />
        ) : (
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴视频地址（抖音/快手/B站/YouTube...）"
            className="bg-secondary border-accent/30 text-xs font-mono h-9 flex-1 min-w-0"
          />
          <Button
            onClick={parseUrl}
            disabled={parsing || !backendOnline || !url.trim()}
            variant="outline"
            className="border-primary/40 text-primary h-9 shrink-0"
          >
            {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            解析
          </Button>
        </div>
        )}

        {/* 解析结果 */}
        {info && (
          <div className="p-3 rounded border border-accent/20 bg-secondary space-y-2">
            {info.thumbnail && (
              <img src={info.thumbnail} alt="" className="max-h-32 rounded object-cover" />
            )}
            <div className="text-sm font-semibold text-foreground">{info.title}</div>
            <div className="text-[11px] text-muted-foreground">
              {info.uploader} · {Math.floor((info.duration || 0) / 60)}:{String((info.duration || 0) % 60).padStart(2, '0')}
            </div>

            {/* 选项 */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant={!audioOnly ? 'default' : 'outline'}
                onClick={() => setAudioOnly(false)}
                className="h-7 text-xs"
              >
                <Film className="h-3.5 w-3.5 mr-1" /> 视频
              </Button>
              <Button
                size="sm"
                variant={audioOnly ? 'default' : 'outline'}
                onClick={() => setAudioOnly(true)}
                className="h-7 text-xs"
              >
                <Music className="h-3.5 w-3.5 mr-1" /> 仅音频
              </Button>
            </div>

            {/* 画质选择 */}
            {!audioOnly && info.formats?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {info.formats.slice(0, 10).map((f: Format) => (
                  <button
                    key={f.format_id}
                    onClick={() => setFormatId(f.format_id)}
                    className={`px-2 py-1 rounded text-[11px] border ${
                      formatId === f.format_id
                        ? 'bg-accent text-accent-foreground border-accent'
                        : 'bg-background text-muted-foreground border-border hover:border-accent/50'
                    }`}
                  >
                    {f.resolution} {f.ext === 'mp4' ? '· MP4' : ''} {fmtSize(f.filesize)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 输出目录 + 下载 */}
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
            placeholder="输出目录"
            className="bg-secondary border-accent/30 text-xs font-mono h-9 flex-1 min-w-0"
          />
          <Button size="sm" variant="outline" onClick={openDir} className="h-9 px-3 text-xs" title="打开下载目录">
            <FolderOpen className="h-4 w-4" />
          </Button>
          <Button
            onClick={batchMode ? startBatch : start}
            disabled={status === 'downloading' || !backendOnline}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 shrink-0"
          >
            {status === 'downloading' ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1.5" />
            )}
            {batchMode ? '批量下载' : '下载'}
          </Button>
        </div>

        {/* 进度 */}
        {status === 'downloading' && (
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-background overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-[11px] text-muted-foreground">{progress.toFixed(1)}%</div>
          </div>
        )}

        {status === 'completed' && result?.filepath && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <CheckCircle2 className="h-4 w-4" />
            <span className="truncate">{result.title || '下载完成'}</span>
          </div>
        )}

        {status === 'failed' && result?.error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="truncate">{result.error}</span>
          </div>
        )}

        {/* 历史记录 */}
        {history.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <History className="h-3 w-3" /> 下载历史（{history.length}）
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setUrl(h.url)}
                  className="w-full text-left text-[11px] px-2 py-1 rounded bg-background hover:bg-accent/10 truncate"
                  title={h.url}
                >
                  {h.title || h.url}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
