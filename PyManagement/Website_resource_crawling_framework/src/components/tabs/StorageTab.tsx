import { FolderTree, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { DownloadedResource } from '@/pages/Dashboard';

const CATEGORIES = [
  { cat: 'images', label: '图片资源', path: 'downloads/images/', ext: 'jpg, png, webp, gif, svg' },
  { cat: 'videos', label: '视频多媒体', path: 'downloads/videos/', ext: 'mp4, m3u8, ts, webm' },
  { cat: 'audios', label: '音频媒体', path: 'downloads/audios/', ext: 'mp3, wav, flac, aac' },
  { cat: 'documents', label: '各类文档', path: 'downloads/documents/', ext: 'pdf, docx, xlsx, txt' },
  { cat: 'archives', label: '压缩归档', path: 'downloads/archives/', ext: 'zip, tar.gz, 7z, rar' },
  { cat: 'code', label: '样式与脚本', path: 'downloads/code/', ext: 'css, js, ts, map' },
  { cat: 'data', label: '接口数据包', path: 'downloads/data/', ext: 'json, xml, csv' },
  { cat: 'others', label: '其它未分类', path: 'downloads/others/', ext: '未知二进制流' },
];

const VALID_CATEGORIES = CATEGORIES.map((c) => c.cat);

interface Props {
  resources: DownloadedResource[];
  onCleanup: (category: string) => Promise<string> | void;
}

export default function StorageTab({ resources, onCleanup }: Props) {
  const countOf = (cat: string) => resources.filter((r) => r.category === cat).length;

  return (
    <Card className="bg-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-primary flex items-center gap-2">
              <FolderTree className="h-4 w-4" />
              智能资源类型分类与自动归档目录
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              分类计数基于后端真实归档数据实时统计，支持按分类或全量清理磁盘文件
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs h-7 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                清理全部
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle>确认清理全部下载文件？</AlertDialogTitle>
                <AlertDialogDescription>
                  将删除 downloads 目录下所有分类的已下载文件（含 M3U8 合并视频与切片缓存），操作不可恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={() => onCleanup('all')}>确认清理</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map((item) => {
            const count = countOf(item.cat);
            return (
              <div key={item.cat} className="p-3 rounded bg-secondary border border-primary/15 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{item.label}</span>
                  <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                    {count} 文件
                  </Badge>
                </div>
                <div className="text-[10px] text-accent font-mono">{item.path}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground truncate flex-1 min-w-0">{item.ext}</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={count === 0}
                        className="h-6 px-1.5 text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={`清理${item.label}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card">
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认清理 {item.label}？</AlertDialogTitle>
                        <AlertDialogDescription>
                          将删除 downloads/{item.cat}/ 目录下的 {count} 个文件，操作不可恢复。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onCleanup(item.cat)}>确认清理</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-muted-foreground">
          合法分类: {VALID_CATEGORIES.join(' / ')}，终端可执行 <code className="text-primary">cleanup &lt;分类|all&gt;</code>
        </div>
      </CardContent>
    </Card>
  );
}
