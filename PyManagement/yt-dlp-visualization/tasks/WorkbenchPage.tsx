import { useState } from 'react'
import { Link2, Search, Loader2, ImageOff, Clock, User, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useConfig } from '@/contexts/ConfigContext'
import { resolveVideoMeta, addBatchTask } from '@/lib/api'
import { QUICK_FORMATS } from '@/lib/yt-dlp/quickFormats'
import { CommandPreview } from '@/components/CommandPreview'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function formatDuration(sec?: number) {
  if (!sec || sec <= 0) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function WorkbenchPage() {
  const { config, updateField, applyPreset, resetConfig, videoMeta, setVideoMeta, resolving, setResolving } = useConfig()
  const [urlInput, setUrlInput] = useState('')

  const handleResolve = async () => {
    const firstUrl = urlInput.split('\n').map((u) => u.trim()).find(Boolean)
    if (!firstUrl) {
      toast.error('请先输入视频链接')
      return
    }
    if (!/^https?:\/\//i.test(firstUrl)) {
      toast.error('请输入以 http(s):// 开头的完整链接')
      return
    }
    setResolving(true)
    setVideoMeta(null)
    const { data, error } = await resolveVideoMeta(firstUrl)
    setResolving(false)
    if (error || !data) {
      toast.error(error || '解析失败，可忽略预览直接生成命令')
      return
    }
    setVideoMeta(data)
    toast.success('解析成功')
  }

  const handleSaveTask = async () => {
    const firstUrl = urlInput.split('\n').map((u) => u.trim()).find(Boolean)
    if (!firstUrl) {
      toast.error('请先输入视频链接')
      return
    }
    const { error } = await addBatchTask({
      url: firstUrl,
      title: videoMeta?.title ?? '',
      preset_name: QUICK_FORMATS.find((f) => f.id === config.quickFormat)?.label ?? '自定义',
      config: { ...config, urls: urlInput },
    })
    if (error) {
      toast.error('保存失败：' + error)
      return
    }
    toast.success('已保存到批量任务')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* URL 输入与元数据预览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-primary" />
            视频链接解析
          </CardTitle>
          <CardDescription>
            粘贴单个视频、播放列表或频道链接，支持多行批量输入
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value)
              updateField('urls', e.target.value)
            }}
            placeholder={'https://www.youtube.com/watch?v=...\nhttps://vimeo.com/...'}
            className="min-h-24 font-mono text-sm"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleResolve} disabled={resolving} className="gap-1.5">
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {resolving ? '解析中...' : '解析视频信息'}
            </Button>
            <Button variant="outline" onClick={handleSaveTask} className="gap-1.5">
              <Save className="h-4 w-4" />
              保存为任务
            </Button>
            <Button variant="ghost" onClick={resetConfig} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="h-4 w-4" />
              重置配置
            </Button>
          </div>

          {/* 元数据预览 */}
          {(videoMeta || resolving) && (
            <div className="flex gap-4 rounded-md border border-border bg-secondary/30 p-3">
              <div className="h-24 w-40 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {videoMeta?.thumbnail ? (
                  <img src={videoMeta.thumbnail} alt={videoMeta.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {resolving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageOff className="h-5 w-5" />}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="line-clamp-2 text-sm font-medium text-foreground">
                  {videoMeta?.title || (resolving ? '正在解析...' : '暂无信息')}
                </p>
                {videoMeta?.source && (
                  <Badge variant="secondary" className="text-xs">
                    {videoMeta.source}
                  </Badge>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {videoMeta?.author && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {videoMeta.author}
                    </span>
                  )}
                  {formatDuration(videoMeta?.duration) && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(videoMeta?.duration)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 快速格式选择器 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">快速选择下载格式</CardTitle>
          <CardDescription>一键选择常见画质或音频格式，小白也能轻松上手</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {QUICK_FORMATS.map((f) => {
              const active = config.formatMode === 'quick' && config.quickFormat === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => applyPreset(f.apply)}
                  className={cn(
                    'flex h-full flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background hover:border-primary/50 hover:bg-secondary/40',
                  )}
                >
                  <span className={cn('text-sm font-medium', active ? 'text-primary' : 'text-foreground')}>
                    {f.label}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">{f.desc}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 命令预览 */}
      <CommandPreview />
    </div>
  )
}