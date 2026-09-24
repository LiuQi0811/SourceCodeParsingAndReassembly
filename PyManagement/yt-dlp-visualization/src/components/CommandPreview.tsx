import { useMemo, useState } from 'react'
import { Copy, Check, Download, Terminal, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useConfig } from '@/contexts/ConfigContext'
import { generateCommand } from '@/lib/yt-dlp/commandGenerator'
import { OPTIONS_CATALOG } from '@/lib/yt-dlp/optionsCatalog'
import { CATEGORY_LABELS, type OptionCategory, type Platform } from '@/lib/yt-dlp/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'bash', label: 'Linux/macOS' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'Windows CMD' },
]

const PLATFORM_HINT: Record<Platform, string> = {
  bash: '适用于 Bash / Zsh 终端',
  powershell: '适用于 Windows PowerShell',
  cmd: '适用于 Windows CMD 命令提示符',
}

// 参数类别 → 高亮颜色 token（语义化，随主题切换）
const CATEGORY_COLOR: Record<OptionCategory, string> = {
  general: 'text-primary',
  selection: 'text-accent',
  audio: 'text-chart-2',
  network: 'text-info',
  geo: 'text-warning',
  subtitle: 'text-chart-3',
  postprocess: 'text-chart-4',
  auth: 'text-destructive',
  verbosity: 'text-muted-foreground',
  workarounds: 'text-chart-5',
  filesystem: 'text-info',
}

interface Token {
  text: string
  type: 'binary' | 'url' | 'flag' | 'value'
  category?: OptionCategory
}

interface TokenGroup {
  category: OptionCategory | 'binary' | 'url'
  label: string
  tokens: Token[]
}

function buildFlagCategoryMap(): Map<string, OptionCategory> {
  const map = new Map<string, OptionCategory>()
  for (const opt of OPTIONS_CATALOG) {
    map.set(opt.flag, opt.category)
    if (opt.shortFlag) map.set(opt.shortFlag, opt.category)
  }
  return map
}

const FLAG_CATEGORY_MAP = buildFlagCategoryMap()

function tokenize(args: string[], url: string): Token[] {
  const tokens: Token[] = [{ text: 'yt-dlp', type: 'binary' }]
  if (url.trim()) tokens.push({ text: url.trim(), type: 'url' })
  for (const arg of args) {
    if (arg === url.trim()) continue
    const isFlag = arg.startsWith('-')
    if (isFlag) {
      const cat = FLAG_CATEGORY_MAP.get(arg) ?? 'general'
      tokens.push({ text: arg, type: 'flag', category: cat })
    } else {
      const lastFlag = [...tokens].reverse().find((t) => t.type === 'flag')
      tokens.push({ text: arg, type: 'value', category: lastFlag?.category ?? 'general' })
    }
  }
  return tokens
}

function groupTokens(tokens: Token[]): TokenGroup[] {
  const groups: TokenGroup[] = []
  let current: TokenGroup | null = null
  for (const t of tokens) {
    const key = t.type === 'binary' ? 'binary' : t.type === 'url' ? 'url' : (t.category ?? 'general')
    if (!current || current.category !== key) {
      current = {
        category: key,
        label:
          key === 'binary'
            ? '程序'
            : key === 'url'
              ? '目标链接'
              : CATEGORY_LABELS[key as OptionCategory],
        tokens: [],
      }
      groups.push(current)
    }
    current.tokens.push(t)
  }
  return groups
}

function tokenColor(t: Token): string {
  if (t.type === 'binary') return 'text-accent'
  if (t.type === 'url') return 'text-chart-3'
  if (t.type === 'flag') return CATEGORY_COLOR[t.category ?? 'general']
  return 'text-foreground/80'
}

export function CommandPreview() {
  const { config, platform, setPlatform } = useConfig()
  const [copied, setCopied] = useState(false)
  const [folded, setFolded] = useState(false)
  const command = generateCommand(config, platform)

  const groups = useMemo(
    () => groupTokens(tokenize(command.args, config.urls)),
    [command.args, config.urls],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command.full)
      setCopied(true)
      toast.success('命令已复制到剪贴板')
      setTimeout(() => setCopied(false), 1500)
    } catch (_e) {
      toast.error('复制失败，请手动选择复制')
    }
  }

  const handleDownload = () => {
    const isWin = platform === 'cmd'
    const ext = isWin ? 'bat' : 'sh'
    const content = isWin
      ? `@echo off\nchcp 65001 >nul\n${command.full}\n`
      : `#!/usr/bin/env bash\nset -e\n${command.full}\n`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yt-dlp-download.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`已下载执行脚本 (.${ext})`)
  }

  return (
    <div className="terminal-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border bg-secondary/40 p-3 md:flex-row md:items-center md:justify-between md:p-4">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium text-foreground truncate">生成的 yt-dlp 命令</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tabs value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <TabsList className="h-8 bg-muted">
              {PLATFORMS.map((p) => (
                <TabsTrigger key={p.value} value={p.value} className="h-6 px-2 text-xs">
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Collapsible open={!folded} onOpenChange={(o) => setFolded(!o)}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 border-b border-border bg-secondary/20 px-4 py-2 text-left transition-colors hover:bg-secondary/40"
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                !folded && 'rotate-90',
              )}
            />
            <span className="text-xs text-muted-foreground">
              {folded ? '展开参数分词视图' : '按参数类别分词展示'}
            </span>
            <span className="ml-auto flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <span
                  key={String(g.category)}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {g.label}
                </span>
              ))}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-h-72 overflow-auto p-4">
            <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed md:text-sm">
              <span className="text-accent">$</span>{' '}
              {groups.map((g, gi) => (
                <span key={gi}>
                  {g.tokens.map((t, ti) => (
                    <span key={ti} className={cn(tokenColor(t), t.type === 'flag' && 'text-glow')}>
                      {t.text}{' '}
                    </span>
                  ))}
                </span>
              ))}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-col gap-2 border-t border-border p-3 md:flex-row md:items-center md:justify-between md:p-4">
        <p className="text-xs text-muted-foreground">{PLATFORM_HINT[platform]}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            下载脚本
          </Button>
          <Button size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制命令'}
          </Button>
        </div>
      </div>
    </div>
  )
}