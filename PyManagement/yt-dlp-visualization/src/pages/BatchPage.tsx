import { useEffect, useState } from 'react'
import {
  ListChecks,
  Plus,
  Trash2,
  Download,
  FileText,
  Loader2,
  Eraser,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfig } from '@/contexts/ConfigContext'
import {
  fetchBatchTasks,
  addBatchTask,
  deleteBatchTask,
  clearBatchTasks,
} from '@/lib/api'
import { generateBatchScript } from '@/lib/yt-dlp/commandGenerator'
import type { BatchTask, Platform } from '@/lib/yt-dlp/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function BatchPage() {
  const { config } = useConfig()
  const [tasks, setTasks] = useState<BatchTask[]>([])
  const [loading, setLoading] = useState(true)
  const [urlInput, setUrlInput] = useState('')
  const [scriptPlatform, setScriptPlatform] = useState<Platform>('bash')

  const load = async () => {
    setLoading(true)
    const data = await fetchBatchTasks()
    setTasks(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async () => {
    const urls = urlInput
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
    if (urls.length === 0) {
      toast.error('请输入至少一个链接')
      return
    }
    let ok = 0
    for (const url of urls) {
      const { error } = await addBatchTask({
        url,
        title: '',
        preset_name: '',
        config: { ...config, urls: url },
      })
      if (!error) ok++
    }
    toast.success(`已添加 ${ok} 个任务`)
    setUrlInput('')
    load()
  }

  const handleDelete = async (id: string) => {
    await deleteBatchTask(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const handleClear = async () => {
    const res = await clearBatchTasks()
    if (res.error) {
      toast.error('清空失败：' + res.error)
      return
    }
    setTasks([])
    toast.success('已清空所有任务')
  }

  const handleExportScript = () => {
    if (tasks.length === 0) {
      toast.error('暂无任务可导出')
      return
    }
    const script = generateBatchScript(
      tasks.map((t) => ({ config: { ...config, urls: t.url }, platform: scriptPlatform })),
      scriptPlatform,
    )
    const ext = scriptPlatform === 'cmd' ? 'bat' : 'sh'
    download(`yt-dlp-batch.${ext}`, script)
    toast.success(`已导出批处理脚本 (.${ext})`)
  }

  const handleExportBatchFile = () => {
    if (tasks.length === 0) {
      toast.error('暂无任务可导出')
      return
    }
    const content = tasks.map((t) => t.url).join('\n')
    download('yt-dlp-urls.txt', content)
    toast.success('已导出 URL 列表文件（配合 --batch-file 使用）')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">批量任务</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          批量添加链接，使用当前配置生成批处理脚本或 URL 列表文件
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">添加任务</CardTitle>
          <CardDescription>每行一个链接，将使用当前工作台配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={'https://www.youtube.com/watch?v=xxx\nhttps://vimeo.com/xxx'}
            className="min-h-24 font-mono text-sm"
          />
          <Button onClick={handleAdd} className="gap-1.5">
            <Plus className="h-4 w-4" />
            添加到任务列表
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">任务列表（{tasks.length}）</CardTitle>
              <CardDescription>导出为可执行脚本或 URL 列表</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={scriptPlatform} onValueChange={(v) => setScriptPlatform(v as Platform)}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bash">Linux/macOS</SelectItem>
                  <SelectItem value="powershell">PowerShell</SelectItem>
                  <SelectItem value="cmd">Windows CMD</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleExportScript} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                导出脚本
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportBatchFile} className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                URL 列表
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5 text-destructive">
                <Eraser className="h-3.5 w-3.5" />
                清空
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <ListChecks className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">暂无任务，添加链接后可批量导出</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-secondary/20 p-3"
                >
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {t.preset_name || '自定义'}
                  </Badge>
                  <p className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                    {t.url}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(t.id)}
                    className="h-7 w-7 shrink-0 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}