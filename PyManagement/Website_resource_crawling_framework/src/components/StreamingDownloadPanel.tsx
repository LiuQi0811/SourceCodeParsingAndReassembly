import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Film,
  Download,
  Play,
  X,
  Pause,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Link2,
  Radar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

export type M3U8Status =
  | 'pending'
  | 'parsing'
  | 'downloading'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface M3U8Task {
  task_id: string;
  url: string;
  status: M3U8Status;
  total_segments: number;
  downloaded_segments: number;
  progress: number;
  speed: number;
  merged_file: string | null;
  file_size: number;
  error: string | null;
  created_at: number;
  updated_at: number;
}

const STATUS_META: Record<M3U8Status, { label: string; color: string; dot: string }> = {
  pending: { label: '等待中', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  parsing: { label: '解析清单', color: 'text-info', dot: 'bg-info' },
  downloading: { label: '下载切片', color: 'text-primary', dot: 'bg-primary' },
  merging: { label: '合并中', color: 'text-accent', dot: 'bg-accent' },
  completed: { label: '已完成', color: 'text-primary', dot: 'bg-primary' },
  failed: { label: '失败', color: 'text-destructive', dot: 'bg-destructive' },
  cancelled: { label: '已取消', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  paused: { label: '已暂停', color: 'text-accent', dot: 'bg-accent' },
};

const ACTIVE_STATUSES: M3U8Status[] = ['pending', 'parsing', 'downloading', 'merging', 'paused'];

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface Props {
  backendUrl: string;
  backendOnline: boolean;
  detectedStreams?: { url: string; type: string; source: string }[];
}

export default function StreamingDownloadPanel({ backendUrl, backendOnline, detectedStreams = [] }: Props) {
  const [tasks, setTasks] = useState<M3U8Task[]>([]);
  const [m3u8Url, setM3u8Url] = useState('');
  const [referer, setReferer] = useState('');
  const [outputDir, setOutputDir] = useState('downloads/videos');
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const api = async (path: string, opts?: RequestInit) => {
    const res = await fetch(`${backendUrl}${path}`, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const refreshTasks = useCallback(async () => {
    try {
      const data = await api('/api/m3u8/tasks');
      if (data.tasks) {
        setTasks(data.tasks as M3U8Task[]);
      }
    } catch {
      // 后端不可达时忽略
    }
  }, [backendUrl]);

  // 初次加载与后端恢复时刷新
  useEffect(() => {
    if (backendOnline) refreshTasks();
  }, [backendOnline, refreshTasks]);

  // 有活跃任务时轮询进度
  const prevStatusRef = useRef<Record<string, M3U8Status>>({});
  useEffect(() => {
    const hasActive = tasks.some((t) => ACTIVE_STATUSES.includes(t.status));
    if (hasActive && backendOnline) {
      if (!pollRef.current) {
        pollRef.current = window.setInterval(refreshTasks, 1000);
      }
    } else if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    // 完成/失败通知
    tasks.forEach((t) => {
      const prev = prevStatusRef.current[t.task_id];
      if (prev && prev !== t.status && (t.status === 'completed' || t.status === 'failed')) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(
            t.status === 'completed' ? '下载完成' : '下载失败',
            { body: `${t.downloaded_segments}/${t.total_segments} 切片 · ${formatSize(t.file_size)}` },
          );
        }
      }
      prevStatusRef.current[t.task_id] = t.status;
    });
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [tasks, backendOnline, refreshTasks]);

  // 请求通知权限
  useEffect(() => {
    if (backendOnline && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [backendOnline]);

  const startDownload = async () => {
    const url = m3u8Url.trim();
    if (!url) {
      toast.error('请填写 M3U8 播放列表地址');
      return;
    }
    if (!backendOnline) {
      toast.error('抓取后端服务未运行，请先启动后台服务 (端口 8000)');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api('/api/m3u8/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, referer: referer.trim(), output_dir: outputDir.trim() }),
      });
      if (data.status === 'success' && data.task) {
        toast.success('M3U8 下载任务已创建，正在解析切片清单...');
        setTasks((prev) => [data.task as M3U8Task, ...prev]);
        setM3u8Url('');
      } else {
        toast.error(data.message || '创建下载任务失败');
      }
    } catch (e: any) {
      toast.error(`创建失败: ${e?.message || '网络错误'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 一键下载抓取时检测到的流媒体地址
  const startDownloadUrl = async (url: string) => {
    if (!backendOnline) {
      toast.error('抓取后端服务未运行，请先启动后台服务 (端口 8000)');
      return;
    }
    try {
      const data = await api('/api/m3u8/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (data.status === 'success' && data.task) {
        toast.success('M3U8 下载任务已创建，正在解析切片清单...');
        setTasks((prev) => [data.task as M3U8Task, ...prev]);
      } else {
        toast.error(data.message || '创建下载任务失败');
      }
    } catch (e: any) {
      toast.error(`创建失败: ${e?.message || '网络错误'}`);
    }
  };

  const cancelTask = async (taskId: string) => {
    try {
      await api(`/api/m3u8/task/${taskId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      toast.info('已取消下载任务');
      refreshTasks();
    } catch {
      toast.error('取消失败');
    }
  };

  const startBatch = async () => {
    const urls = batchUrls.split('\n').map((s) => s.trim()).filter(Boolean);
    if (urls.length === 0) {
      toast.error('请填写至少一个 m3u8 地址（每行一个）');
      return;
    }
    if (!backendOnline) {
      toast.error('后端未运行');
      return;
    }
    setSubmitting(true);
    let ok = 0;
    for (const url of urls) {
      try {
        const data = await api('/api/m3u8/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, output_dir: outputDir.trim() }),
        });
        if (data.status === 'success' && data.task) {
          setTasks((prev) => [data.task as M3U8Task, ...prev]);
          ok++;
        }
      } catch { /* skip */ }
    }
    toast.success(`批量创建 ${ok}/${urls.length} 个任务`);
    setBatchUrls('');
    setSubmitting(false);
  };

  const pauseTask = async (taskId: string) => {
    try {
      await api(`/api/m3u8/task/${taskId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      toast.info('已暂停（已下分片保留）');
      refreshTasks();
    } catch {
      toast.error('暂停失败');
    }
  };

  const resumeTask = async (taskId: string) => {
    try {
      await api(`/api/m3u8/task/${taskId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      toast.success('已继续（断点续传）');
      refreshTasks();
    } catch {
      toast.error('继续失败');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await api(`/api/m3u8/task/${taskId}`, { method: 'DELETE' });
      toast.info('已删除任务记录');
      setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    } catch {
      toast.error('删除失败');
    }
  };

  const exportCsv = () => {
    const header = 'task_id,url,status,total,downloaded,progress,size,error\n';
    const rows = tasks.map((t) =>
      [t.task_id, t.url, t.status, t.total_segments, t.downloaded_segments, t.progress, t.file_size, (t.error || '').replace(/,/g, ' ')].join(','),
    );
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'm3u8_tasks.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('已导出 CSV');
  };

  const playUrl = (taskId: string) => `${backendUrl}/downloads/videos/${taskId}.ts`;

  const activeCount = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status)).length;
  const doneCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-4">
      {/* 新建下载任务 */}
      <Card className="bg-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary flex items-center gap-2">
            <Film className="h-4 w-4" />
            M3U8 流媒体下载
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            粘贴 HLS(m3u8) 播放列表地址，引擎将解析切片清单、并发下载全部分片并合并为可播放的 TS 文件
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <Button
              size="sm"
              variant={batchMode ? 'default' : 'outline'}
              onClick={() => setBatchMode(!batchMode)}
              className="h-7 text-xs"
            >
              {batchMode ? '单条模式' : '批量模式'}
            </Button>
            <span className="text-muted-foreground text-[11px]">
              {batchMode ? '每行一个 m3u8 地址' : '粘贴单个 m3u8 地址'}
            </span>
          </div>
          {batchMode ? (
            <textarea
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              placeholder={'https://a.com/1.m3u8\nhttps://b.com/2.m3u8'}
              rows={4}
              className="w-full bg-secondary border-primary/30 text-xs font-mono rounded-md p-2.5 resize-y"
            />
          ) : (
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                value={m3u8Url}
                onChange={(e) => setM3u8Url(e.target.value)}
                placeholder="https://example.com/path/index.m3u8"
                className="bg-secondary border-primary/30 text-xs font-mono h-9 flex-1 min-w-0"
              />
              <Input
                value={referer}
                onChange={(e) => setReferer(e.target.value)}
                placeholder="Referer（可选，防盗链绕过）"
                className="bg-secondary border-primary/30 text-xs font-mono h-9 md:w-64 shrink-0"
              />
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="输出目录（默认 downloads/videos）"
              className="bg-secondary border-primary/30 text-xs font-mono h-9 flex-1 min-w-0"
            />
            <Button
              onClick={batchMode ? startBatch : startDownload}
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 shrink-0"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              {batchMode ? '批量下载' : '开始下载'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="border-primary/40 text-primary text-[10px] bg-primary/5">
              {backendOnline ? 'ONLINE 服务端真实下载' : 'OFFLINE 服务未运行'}
            </Badge>
            <span>支持 Master/Media Playlist、AES-128 加密切片、并发分片下载与二进制合并</span>
          </div>
        </CardContent>
      </Card>

      {/* 抓取时自动检测到的流媒体地址，一键下载 */}
      {detectedStreams.length > 0 && (
        <Card className="bg-card border-accent/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-accent flex items-center gap-2">
              <Radar className="h-4 w-4" />
              页面流媒体自动检测 ({detectedStreams.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              抓取页面时自动识别到的 m3u8 / mpd / flv / rtmp 等流媒体地址，可一键创建下载任务
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {detectedStreams.slice(0, 8).map((s, i) => (
              <div
                key={`${s.url}-${i}`}
                className="flex flex-col md:flex-row md:items-center gap-2 p-2.5 rounded border border-accent/20 bg-secondary"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-accent/40 text-accent text-[10px] uppercase shrink-0">
                      {s.type || 'hls'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground shrink-0">{s.source || ''}</span>
                  </div>
                  <div className="text-[11px] font-mono text-foreground break-all mt-1">{s.url}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => startDownloadUrl(s.url)}
                  disabled={!backendOnline}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-xs h-8 shrink-0"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  一键下载
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 任务概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-primary/20 shadow-none">
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">任务总数</div>
            <div className="text-xl font-bold text-foreground mt-0.5">{tasks.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-primary/20 shadow-none">
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">进行中</div>
            <div className="text-xl font-bold text-info mt-0.5">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-primary/20 shadow-none">
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">已完成</div>
            <div className="text-xl font-bold text-primary mt-0.5">{doneCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-primary/20 shadow-none">
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">总切片下载</div>
            <div className="text-xl font-bold text-accent mt-0.5">
              {tasks.reduce((s, t) => s + t.downloaded_segments, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任务列表 */}
      <Card className="bg-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            下载任务监控
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs">
              <Film className="h-8 w-8 mx-auto mb-2 opacity-40" />
              暂无下载任务，请在上方输入 M3U8 地址开始流媒体抓取
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const meta = STATUS_META[task.status];
                const isActive = ACTIVE_STATUSES.includes(task.status);
                const isDone = task.status === 'completed';
                return (
                  <div
                    key={task.task_id}
                    className="p-3 rounded border border-primary/20 bg-secondary space-y-2.5"
                  >
                    {/* 头部：URL + 状态 */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <Link2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span className="text-[11px] font-mono text-foreground truncate" title={task.url}>
                          {task.url}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] border-current/40 ${meta.color} bg-current/5`}
                      >
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dot} mr-1.5 ${isActive ? 'animate-pulse' : ''}`} />
                        {meta.label}
                      </Badge>
                    </div>

                    {/* 进度条 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          切片进度：{task.downloaded_segments} / {task.total_segments || '?'}
                          {task.status === 'downloading' && task.speed > 0 && (
                            <span className="ml-2 text-accent">{task.speed.toFixed(1)} 片/s</span>
                          )}
                        </span>
                        <span className={`font-semibold ${meta.color}`}>
                          {task.status === 'merging' ? '合并中…' : `${task.progress}%`}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-background overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            task.status === 'merging'
                              ? 'bg-accent animate-pulse w-full'
                              : task.status === 'failed'
                              ? 'bg-destructive'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${task.status === 'merging' ? 100 : task.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* 底部信息与操作 */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        {task.file_size > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            {formatSize(task.file_size)}
                          </span>
                        )}
                        {task.status === 'completed' && task.merged_file && (
                          <span className="truncate max-w-[240px]" title={task.merged_file}>
                            {task.merged_file}
                          </span>
                        )}
                        {task.status === 'failed' && task.error && (
                          <span className="flex items-center gap-1 text-destructive truncate max-w-[300px]" title={task.error}>
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {task.error}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(task.status === 'downloading' || task.status === 'parsing') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => pauseTask(task.task_id)}
                            className="border-accent/40 text-accent hover:bg-accent/10 text-[11px] h-7"
                          >
                            <Pause className="h-3 w-3 mr-1" />
                            暂停
                          </Button>
                        )}
                        {task.status === 'paused' && (
                          <Button
                            size="sm"
                            onClick={() => resumeTask(task.task_id)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[11px] h-7"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            继续
                          </Button>
                        )}
                        {(isActive && task.status !== 'paused') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelTask(task.task_id)}
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 text-[11px] h-7"
                          >
                            <X className="h-3 w-3 mr-1" />
                            取消
                          </Button>
                        )}
                        {isDone && (
                          <Button
                            size="sm"
                            asChild
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[11px] h-7"
                          >
                            <a href={playUrl(task.task_id)} target="_blank" rel="noreferrer">
                              <Play className="h-3 w-3 mr-1" />
                              播放/下载
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTask(task.task_id)}
                          className="text-muted-foreground hover:text-destructive text-[11px] h-7 px-2"
                          title="删除任务记录"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}