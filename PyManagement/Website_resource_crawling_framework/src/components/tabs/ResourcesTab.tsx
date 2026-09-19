import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Music, Download, File as FileIcon, FolderOpen, Search, SearchX, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DownloadedResource, PreviewType } from '@/pages/Dashboard';

interface Props {
  downloadedResources: DownloadedResource[];
  previewResource: DownloadedResource | null;
  setPreviewResource: (v: DownloadedResource | null) => void;
  categoryIcons: Record<string, React.ReactNode>;
  previewLabel: Record<string, string>;
  backendUrl: string;
}

/* ── 图片灯箱：滚轮缩放 + 拖动平移 + 双击还原 ─────────────────── */
function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const zoomBy = useCallback((delta: number) => {
    setScale((s) => Math.min(4, Math.max(0.5, +(s + delta).toFixed(2))));
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{ height: 'min(60vh, 520px)' }}
      onWheel={(e) => {
        e.preventDefault();
        zoomBy(e.deltaY < 0 ? 0.15 : -0.15);
      }}
      onDoubleClick={reset}
    >
      {/* 缩放控制条 */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border bg-background/90 px-1.5 py-1 shadow">
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => zoomBy(-0.25)} title="缩小">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] text-muted-foreground min-w-8 text-center">{Math.round(scale * 100)}%</span>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => zoomBy(0.25)} title="放大">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={reset} title="还原">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="h-full w-full flex items-center justify-center overflow-hidden">
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain bg-background transition-transform duration-100 cursor-grab active:cursor-grabbing"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: 'center',
          }}
          onPointerDown={(e) => {
            if (scale <= 1) return;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            setPos({
              x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
              y: dragRef.current.originY + (e.clientY - dragRef.current.startY),
            });
          }}
          onPointerUp={() => (dragRef.current = null)}
          onPointerCancel={() => (dragRef.current = null)}
        />
      </div>
      {scale > 1 && (
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground bg-background/80 rounded px-2 py-0.5">
          拖动平移 · 滚轮缩放 · 双击还原
        </p>
      )}
    </div>
  );
}

/* ── 文本真实内容预览 ─────────────────────────────────────── */
function TextPreview({ resource, backendUrl }: { resource: DownloadedResource; backendUrl: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    const path = `${resource.category}/${encodeURIComponent(resource.name)}`;
    fetch(`${backendUrl}/api/resources/content?path=${encodeURIComponent(path)}`)
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d?.message || `HTTP ${r.status}`)));
        return r.json();
      })
      .then((d) => {
        if (!cancelled) {
          setContent(d.content);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || '读取失败');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resource, backendUrl]);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs">正在读取文件内容…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
        <SearchX className="h-12 w-12 text-destructive/60" />
        <p className="text-xs text-destructive">内容读取失败：{error}</p>
      </div>
    );
  }
  return (
    <pre className="p-4 text-xs text-foreground max-h-[60vh] overflow-auto whitespace-pre-wrap break-all bg-background/60 rounded">
      {content}
    </pre>
  );
}

/* ── 视频/音频播放器（倍速 + 错误态） ───────────────────────── */
function MediaPlayer({ resource, kind }: { resource: DownloadedResource; kind: 'video' | 'audio' }) {
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  useEffect(() => {
    setRate(1);
    setFailed(false);
    setBuffering(false);
  }, [resource.id]);

  useEffect(() => {
    if (mediaRef.current) {
      (mediaRef.current as HTMLMediaElement).playbackRate = rate;
    }
  }, [rate]);

  if (failed) {
    return (
      <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
        <Music className="h-14 w-14 text-destructive/60" />
        <p className="text-xs">媒体加载失败，可能格式不受浏览器支持或文件已损坏</p>
        <Button
          size="sm"
          variant="outline"
          className="border-primary/40 text-primary hover:bg-primary/10"
          onClick={() => {
            const a = document.createElement('a');
            a.href = resource.url;
            a.download = resource.name;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast.info(`已开始下载: ${resource.name}`);
          }}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          下载后本地播放
        </Button>
      </div>
    );
  }

  const rates = [0.5, 1, 1.5, 2];

  const handleWaiting = () => setBuffering(true);
  const handleReady = () => setBuffering(false);

  return (
    <div className="space-y-2">
      {kind === 'video' ? (
        <div className="relative">
          <video
            ref={(el) => (mediaRef.current = el)}
            src={resource.url}
            controls
            autoPlay
            className="w-full max-h-[60vh] rounded bg-background"
            onError={() => setFailed(true)}
            onWaiting={handleWaiting}
            onPlaying={handleReady}
            onCanPlay={handleReady}
            onSeeking={handleWaiting}
            onSeeked={handleReady}
          >
            您的浏览器不支持视频播放
          </video>
          {buffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded pointer-events-none">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 flex flex-col items-center gap-4">
          <Music className="h-16 w-16 text-accent" />
          <div className="relative w-full max-w-md">
            <audio
              ref={(el) => (mediaRef.current = el)}
              src={resource.url}
              controls
              autoPlay
              className="w-full"
              onError={() => setFailed(true)}
              onWaiting={handleWaiting}
              onPlaying={handleReady}
              onCanPlay={handleReady}
            >
              您的浏览器不支持音频播放
            </audio>
            {buffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded pointer-events-none">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-[10px] text-muted-foreground mr-1">倍速</span>
        {rates.map((r) => (
          <button
            key={r}
            onClick={() => setRate(r)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
              rate === r ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-accent'
            }`}
          >
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ResourcesTab({
  downloadedResources,
  previewResource,
  setPreviewResource,
  categoryIcons,
  previewLabel,
  backendUrl,
}: Props) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = Array.from(new Set(downloadedResources.map((r) => r.category)));
  const filtered = downloadedResources.filter((r) => {
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (query.trim() && !r.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  const downloadResource = (res: DownloadedResource) => {
    const isLocal = res.url.startsWith('http') && res.url.includes('/downloads/');
    const a = document.createElement('a');
    a.href = res.url;
    if (isLocal) {
      a.download = res.name;
    } else {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(isLocal ? `开始下载: ${res.name}` : `在新标签打开: ${res.name}`);
  };

  return (
    <>
      <Card className="bg-card border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                已下载资源浏览器（在线预览 / 播放）
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                分类目录归档后的资源支持图片预览、视频/音频在线播放与真实文件下载
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">
              {filtered.length} / {downloadedResources.length} 个资源
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 搜索与分类过滤 */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索文件名…"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {['all', ...categories].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    categoryFilter === c
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {c === 'all' ? '全部' : c}
                </button>
              ))}
            </div>
          </div>

          {downloadedResources.length === 0 ? (
            /* 空状态 */
            <div className="py-14 flex flex-col items-center gap-3 text-muted-foreground">
              <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">暂无已下载资源</p>
              <p className="text-xs max-w-sm text-center">
                启动抓取并保存图片 / 视频 / 音频 / 文档后，资源会归档到 downloads 目录并出现在这里，可直接在线预览与播放
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
              <SearchX className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-xs">没有匹配的资源，试试调整搜索词或分类</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((res) => (
                <div
                  key={res.id}
                  className="p-3 rounded-md border border-primary/20 bg-secondary hover:border-primary/50 transition-all flex flex-col gap-2"
                >
                  {/* 缩略预览区（图片不裁切，完整展示） */}
                  <div className="aspect-video w-full rounded bg-background border border-primary/15 overflow-hidden flex items-center justify-center">
                    {res.previewType === 'image' ? (
                      <img
                        src={res.url}
                        alt={res.name}
                        className="w-full h-full object-contain p-1"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        {categoryIcons[res.category]}
                        <span className="text-[10px] uppercase">{res.ext} 文件</span>
                      </div>
                    )}
                  </div>

                  {/* 文件信息 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {categoryIcons[res.category]}
                        <span className="text-xs font-bold text-foreground truncate" title={res.name}>{res.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span className="text-accent">downloads/{res.category}/</span>
                        <span>{res.sizeKb >= 1024 ? `${(res.sizeKb / 1024).toFixed(1)} MB` : `${res.sizeKb} KB`}</span>
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮：预览 + 真实下载 */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setPreviewResource(res)}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      {previewLabel[res.previewType]}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadResource(res)}
                      className="border-primary/40 text-primary hover:bg-primary/10 text-xs shrink-0"
                      title="下载文件"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 预览/播放弹窗 */}
      <Dialog open={!!previewResource} onOpenChange={(open) => !open && setPreviewResource(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl bg-card border-primary/30 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary text-sm flex items-center gap-2">
              {previewResource && categoryIcons[previewResource.category]}
              <span className="truncate">{previewResource?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {previewResource && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <Badge variant="outline" className="border-accent/40 text-accent bg-accent/5">
                  downloads/{previewResource.category}/
                </Badge>
                <span>大小: {previewResource.sizeKb >= 1024 ? `${(previewResource.sizeKb / 1024).toFixed(1)} MB` : `${previewResource.sizeKb} KB`}</span>
                <span>类型: .{previewResource.ext}</span>
              </div>

              {/* 预览主体 */}
              <div className="rounded-md border border-primary/20 bg-background overflow-hidden">
                {previewResource.previewType === 'image' && (
                  <LightboxImage src={previewResource.url} alt={previewResource.name} />
                )}
                {previewResource.previewType === 'video' && (
                  <MediaPlayer resource={previewResource} kind="video" />
                )}
                {previewResource.previewType === 'audio' && (
                  <MediaPlayer resource={previewResource} kind="audio" />
                )}
                {previewResource.previewType === 'text' && (
                  <TextPreview resource={previewResource} backendUrl={backendUrl} />
                )}
                {previewResource.previewType === 'other' && (
                  <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
                    <FileIcon className="h-16 w-16" />
                    <p className="text-xs">该文档类型（.{previewResource.ext}）暂不支持浏览器内联预览</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => downloadResource(previewResource)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      下载文件
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
