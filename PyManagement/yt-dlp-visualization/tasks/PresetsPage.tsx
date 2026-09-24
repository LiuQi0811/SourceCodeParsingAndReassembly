import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bookmark,
  Plus,
  Trash2,
  Pencil,
  Play,
  Download,
  Upload,
  FileCode2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfig } from '@/contexts/ConfigContext'
import {
  fetchPresets,
  createPreset,
  updatePreset,
  deletePreset,
} from '@/lib/api'
import { buildArgs } from '@/lib/yt-dlp/commandGenerator'
import { DEFAULT_CONFIG } from '@/lib/yt-dlp/defaults'
import type { Preset, YtDlpConfig } from '@/lib/yt-dlp/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CATEGORIES = [
  { value: 'custom', label: '自定义' },
  { value: 'video', label: '视频画质' },
  { value: 'audio', label: '音频提取' },
  { value: 'subtitle', label: '字幕' },
  { value: 'network', label: '网络代理' },
]

function configToConf(config: Partial<YtDlpConfig>): string {
  const merged = { ...DEFAULT_CONFIG, ...config }
  const args = buildArgs(merged)
  const lines: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('-')) {
      const next = args[i + 1]
      if (next && !next.startsWith('-')) {
        lines.push(`${a} ${next}`)
        i++
      } else {
        lines.push(a)
      }
    }
  }
  return lines.join('\n')
}

export function PresetsPage() {
  const navigate = useNavigate()
  const { config, loadConfig } = useConfig()
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Preset | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('custom')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const data = await fetchPresets()
    setPresets(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setDescription('')
    setCategory('custom')
    setDialogOpen(true)
  }

  const openEdit = (p: Preset) => {
    setEditing(p)
    setName(p.name)
    setDescription(p.description)
    setCategory(p.category)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入预设名称')
      return
    }
    setSaving(true)
    const payload = {
      name,
      description,
      category,
      config: { ...config, urls: '' } as Partial<YtDlpConfig>,
    }
    const res = editing
      ? await updatePreset(editing.id, payload)
      : await createPreset(payload)
    setSaving(false)
    if (res.error) {
      toast.error('保存失败：' + res.error)
      return
    }
    toast.success(editing ? '预设已更新' : '预设已创建')
    setDialogOpen(false)
    load()
  }

  const handleDelete = async (id: string) => {
    const res = await deletePreset(id)
    if (res.error) {
      toast.error('删除失败：' + res.error)
      return
    }
    toast.success('预设已删除')
    setPresets((prev) => prev.filter((p) => p.id !== id))
  }

  const handleApply = (p: Preset) => {
    loadConfig(p.config)
    toast.success(`已加载预设「${p.name}」`)
    navigate('/')
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'yt-dlp-presets.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('已导出预设 JSON')
  }

  const handleExportConf = (p: Preset) => {
    const conf = configToConf(p.config)
    const blob = new Blob([conf], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${p.name.replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}.conf`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('已导出 .conf 配置文件')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const list = Array.isArray(parsed) ? parsed : [parsed]
      let ok = 0
      for (const item of list) {
        if (!item.name) continue
        await createPreset({
          name: item.name,
          description: item.description || '',
          category: item.category || 'custom',
          config: item.config || {},
        })
        ok++
      }
      toast.success(`已导入 ${ok} 个预设`)
      load()
    } catch (_err) {
      toast.error('导入失败：JSON 格式错误')
    }
    e.target.value = ''
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">预设管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">保存常用配置组合，一键复用</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportJson} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            导出
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            导入
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            新建预设
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : presets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Bookmark className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">还没有预设，点击「新建预设」保存当前配置</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {presets.map((p) => (
            <Card key={p.id} className="flex h-full flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="min-w-0 flex-1 truncate text-sm">{p.name}</CardTitle>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {CATEGORIES.find((c) => c.value === p.category)?.label ?? '自定义'}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2 text-xs">
                  {p.description || '无描述'}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                <Button size="sm" onClick={() => handleApply(p)} className="gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  应用
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportConf(p)} className="gap-1.5">
                  <FileCode2 className="h-3.5 w-3.5" />
                  .conf
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="h-8 w-8 text-muted-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="h-8 w-8 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑预设' : '新建预设'}</DialogTitle>
            <DialogDescription>
              将当前工作台配置保存为预设，方便下次复用
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>预设名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：4K 最高画质" />
            </div>
            <div className="space-y-1.5">
              <Label>描述（可选）</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简单说明该预设用途" className="min-h-16" />
            </div>
            <div className="space-y-1.5">
              <Label>分类</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}