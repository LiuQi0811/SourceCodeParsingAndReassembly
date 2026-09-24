import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, BookOpen, ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { OPTIONS_CATALOG, getOptionsByCategory } from '@/lib/yt-dlp/optionsCatalog'
import { CATEGORY_LABELS, type OptionCategory, type OptionDef } from '@/lib/yt-dlp/types'
import { useConfig } from '@/contexts/ConfigContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CATEGORY_ORDER: OptionCategory[] = [
  'general',
  'selection',
  'audio',
  'network',
  'geo',
  'subtitle',
  'postprocess',
  'auth',
  'verbosity',
  'workarounds',
]

export function HelpPage() {
  const navigate = useNavigate()
  const { config, updateField } = useConfig()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<string>('all')

  const grouped = useMemo(() => getOptionsByCategory(), [])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return OPTIONS_CATALOG.filter((o) => {
      const matchCat = category === 'all' || o.category === category
      const matchKw =
        !kw ||
        o.label.toLowerCase().includes(kw) ||
        o.flag.toLowerCase().includes(kw) ||
        (o.shortFlag?.toLowerCase().includes(kw) ?? false) ||
        o.desc.toLowerCase().includes(kw)
      return matchCat && matchKw
    })
  }, [keyword, category])

  const handleApply = (opt: OptionDef) => {
    if (opt.type === 'switch') {
      updateField(opt.id, true as never)
    } else if (opt.type === 'select') {
      updateField(opt.id, (opt.options?.[0]?.value ?? '') as never)
    } else {
      updateField(opt.id, (opt.placeholder ?? '') as never)
    }
    toast.success(`已应用「${opt.label}」到当前配置`)
  }

  const isApplied = (opt: OptionDef) => {
    const v = config[opt.id]
    if (opt.type === 'switch') return Boolean(v)
    if (opt.type === 'select') return v !== '' && v !== 'none' && v !== 'auto'
    return Boolean(v)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">参数速查</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          收录 yt-dlp 全部常用参数，支持检索与一键应用到当前配置
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索参数名、标志或说明..."
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {CATEGORY_ORDER.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">未找到匹配的参数</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.filter((c) => (grouped.get(c)?.length ?? 0) > 0).map((cat) => {
            const opts = filtered.filter((o) => o.category === cat)
            if (opts.length === 0) return null
            return (
              <Card key={cat}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-primary">{CATEGORY_LABELS[cat]}</CardTitle>
                  <CardDescription className="sr-only">{CATEGORY_LABELS[cat]}分类参数</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {opts.map((opt) => {
                    const applied = isApplied(opt)
                    return (
                      <div
                        key={opt.id}
                        className="flex items-start justify-between gap-3 rounded-md p-2.5 transition-colors hover:bg-secondary/30"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{opt.label}</span>
                            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                              {opt.shortFlag ?? opt.flag}
                            </Badge>
                            {opt.argName && (
                              <span className="font-mono text-[10px] text-accent">&lt;{opt.argName}&gt;</span>
                            )}
                          </div>
                          <p className="text-xs leading-snug text-muted-foreground">{opt.desc}</p>
                        </div>
                        <Button
                          variant={applied ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => handleApply(opt)}
                          className="shrink-0 gap-1"
                        >
                          {applied ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                          {applied ? '已应用' : '应用'}
                        </Button>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => navigate('/options')} className="gap-1.5">
          前往选项配置中心
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}