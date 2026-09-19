import { Eye, Music, Download, File as FileIcon, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
}

export default function ResourcesTab({
  downloadedResources,
  previewResource,
  setPreviewResource,
  categoryIcons,
  previewLabel,
}: Props) {
  return (
    <>
      <Card className="bg-card border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                已下载资源浏览器（在线预览 / 播放）
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                分类目录归档后的资源支持图片预览、视频/音频在线播放与文档下载，点击卡片即可打开预览
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">
              {downloadedResources.length} 个资源
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {downloadedResources.map((res) => (
              <div
                key={res.id}
                className="p-3 rounded border border-primary/20 bg-secondary hover:border-primary/50 transition-all flex flex-col gap-2"
              >
                {/* 缩略预览区 */}
                <div className="aspect-video w-full rounded bg-background border border-primary/15 overflow-hidden flex items-center justify-center">
                  {res.previewType === 'image' ? (
                    <img
                      src={res.url}
                      alt={res.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
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
                      <span className="text-xs font-bold text-foreground truncate">{res.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span className="text-accent">downloads/{res.category}/</span>
                      <span>{res.sizeKb >= 1024 ? `${(res.sizeKb / 1024).toFixed(1)} MB` : `${res.sizeKb} KB`}</span>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <Button
                  size="sm"
                  onClick={() => setPreviewResource(res)}
                  className="w-full bg-primary hover:bg-primary/90 text-background font-bold text-xs"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  {previewLabel[res.previewType]}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 预览/播放弹窗 */}
      <Dialog open={!!previewResource} onOpenChange={(open) => !open && setPreviewResource(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl bg-card border-primary/30 text-foreground font-mono">
          <DialogHeader>
            <DialogTitle className="text-primary text-sm flex items-center gap-2">
              {previewResource && categoryIcons[previewResource.category]}
              {previewResource?.name}
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
              <div className="rounded border border-primary/20 bg-background overflow-hidden">
                {previewResource.previewType === 'image' && (
                  <img
                    src={previewResource.url}
                    alt={previewResource.name}
                    className="w-full max-h-[60vh] object-contain bg-background"
                  />
                )}
                {previewResource.previewType === 'video' && (
                  <video
                    src={previewResource.url}
                    controls
                    autoPlay
                    className="w-full max-h-[60vh]"
                  >
                    您的浏览器不支持视频播放
                  </video>
                )}
                {previewResource.previewType === 'audio' && (
                  <div className="p-6 flex flex-col items-center gap-4">
                    <Music className="h-16 w-16 text-accent" />
                    <audio src={previewResource.url} controls autoPlay className="w-full max-w-md">
                      您的浏览器不支持音频播放
                    </audio>
                  </div>
                )}
                {previewResource.previewType === 'text' && (
                  <pre className="p-4 text-xs text-primary max-h-[60vh] overflow-auto">
{`{
  "dataset": "crawler_export_2026",
  "records": 1280,
  "fields": ["url", "title", "category", "encoding"],
  "sample": [
    { "url": "https://example.com/a", "title": "示例标题", "category": "images", "encoding": "utf-8" }
  ]
}`}
                  </pre>
                )}
                {previewResource.previewType === 'other' && (
                  <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
                    <FileIcon className="h-16 w-16" />
                    <p className="text-xs">该文档类型（.{previewResource.ext}）暂不支持浏览器内联预览</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => toast.info(`已触发下载: ${previewResource.name}`)}
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
