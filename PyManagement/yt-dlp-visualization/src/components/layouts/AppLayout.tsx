import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Terminal,
  SlidersHorizontal,
  Bookmark,
  ListChecks,
  BookOpen,
  Menu,
  Github,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { THEME_OPTIONS, useTheme, type ThemeName } from '@/contexts/ThemeContext'
import { Palette, Check } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: '工作台', icon: Terminal, desc: '快速解析与命令生成' },
  { to: '/options', label: '选项配置中心', icon: SlidersHorizontal, desc: '全量参数可视化' },
  { to: '/presets', label: '预设管理', icon: Bookmark, desc: '保存与复用配置' },
  { to: '/batch', label: '批量任务', icon: ListChecks, desc: '多链接批处理导出' },
  { to: '/help', label: '参数速查', icon: BookOpen, desc: '选项检索与文档' },
]

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Terminal className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">yt-dlp 工作台</p>
          <p className="truncate text-xs text-muted-foreground">可视化命令生成器</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex min-h-12 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-md bg-secondary/40 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Github className="h-3.5 w-3.5" />
            <span>基于 yt-dlp 开源项目</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            本工具生成可执行命令，实际下载请在本地终端运行。
          </p>
        </div>
      </div>
    </div>
  )
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const current = THEME_OPTIONS.find((t) => t.name === theme)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-foreground" aria-label="切换主题">
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {THEME_OPTIONS.map((t) => (
          <DropdownMenuItem
            key={t.name}
            onClick={() => setTheme(t.name as ThemeName)}
            className="gap-2"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: t.swatch }}
            />
            <span className="min-w-0 flex-1 truncate text-sm">{t.label}</span>
            {t.name === theme && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PageHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const location = useLocation()
  const current = NAV_ITEMS.find(
    (i) => i.to === location.pathname || (i.to !== '/' && location.pathname.startsWith(i.to)),
  )
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-foreground"
        onClick={onOpenMenu}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">打开菜单</span>
      </Button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-foreground md:text-lg">
          {current?.label ?? '工作台'}
        </h1>
      </div>
      <ThemeSwitcher />
    </header>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* 桌面侧边栏 */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <NavContent />
      </aside>

      {/* 移动端菜单 */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <span className="hidden" aria-hidden />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 border-sidebar-border p-0">
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* 主内容区 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <PageHeader onOpenMenu={() => setOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      {/* CRT 终端覆盖层 */}
      <div className="crt-overlay" aria-hidden />
    </div>
  )
}