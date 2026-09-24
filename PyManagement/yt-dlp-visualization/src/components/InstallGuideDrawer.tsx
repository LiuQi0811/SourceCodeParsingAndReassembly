import { useState } from 'react'
import { Copy, Check, Terminal, Package, AlertTriangle, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

interface InstallGuideDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface CmdBlockProps {
  cmd: string
  comment?: string
}

function CmdBlock({ cmd, comment }: CmdBlockProps) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 1500)
    } catch (_e) {
      toast.error('复制失败，请手动选择')
    }
  }
  return (
    <div className="rounded-md border border-border bg-secondary/30">
      {comment && (
        <p className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">{comment}</p>
      )}
      <div className="flex items-center gap-2 p-3">
        <code className="min-w-0 flex-1 break-all font-mono text-xs text-primary md:text-sm">
          {cmd}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="复制命令"
        >
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function Step({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {index}
        </span>
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
      </div>
      <div className="space-y-2 pl-7">{children}</div>
    </div>
  )
}

export function InstallGuideDrawer({ open, onOpenChange }: InstallGuideDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4 text-primary" />
            本地安装指南
          </SheetTitle>
          <SheetDescription>
            本工具仅生成命令，实际下载需在本地终端运行 yt-dlp。按系统选择对应安装方式。
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Tabs defaultValue="windows">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="windows">Windows</TabsTrigger>
              <TabsTrigger value="macos">macOS</TabsTrigger>
              <TabsTrigger value="linux">Linux</TabsTrigger>
            </TabsList>

            <TabsContent value="windows" className="mt-4 space-y-4">
              <Step index={1} title="安装 yt-dlp">
                <CmdBlock cmd="winget install --id yt-dlp.yt-dlp" comment="推荐：使用 winget（Win10+ 自带）" />
                <CmdBlock cmd="pip install -U yt-dlp" comment="或使用 Python pip（需先装 Python 3.9+）" />
              </Step>
              <Step index={2} title="安装 ffmpeg（合并音视频必需）">
                <CmdBlock cmd="winget install --id Gyan.FFmpeg" comment="用于合并 1080p 及以上画质" />
              </Step>
              <Step index={3} title="验证安装">
                <CmdBlock cmd="yt-dlp --version" />
                <CmdBlock cmd="ffmpeg -version" />
              </Step>
            </TabsContent>

            <TabsContent value="macos" className="mt-4 space-y-4">
              <Step index={1} title="安装 yt-dlp">
                <CmdBlock cmd="brew install yt-dlp" comment="推荐：使用 Homebrew" />
                <CmdBlock cmd="pip install -U yt-dlp" comment="或使用 pip" />
              </Step>
              <Step index={2} title="安装 ffmpeg">
                <CmdBlock cmd="brew install ffmpeg" />
              </Step>
              <Step index={3} title="验证安装">
                <CmdBlock cmd="yt-dlp --version" />
              </Step>
            </TabsContent>

            <TabsContent value="linux" className="mt-4 space-y-4">
              <Step index={1} title="安装 yt-dlp">
                <CmdBlock cmd="pip install -U yt-dlp" comment="推荐：使用 pip" />
                <CmdBlock cmd="sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp" comment="或下载独立二进制" />
              </Step>
              <Step index={2} title="安装 ffmpeg">
                <CmdBlock cmd="sudo apt install ffmpeg" comment="Debian/Ubuntu" />
                <CmdBlock cmd="sudo dnf install ffmpeg" comment="Fedora" />
              </Step>
              <Step index={3} title="验证安装">
                <CmdBlock cmd="yt-dlp --version" />
              </Step>
            </TabsContent>
          </Tabs>

          {/* 环境检测 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">环境检测</h3>
            </div>
            <div className="space-y-2">
              <Step index={1} title="确认 yt-dlp 已加入 PATH">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  打开终端（Windows 用 PowerShell 或 CMD），输入 <code className="text-primary">yt-dlp --version</code>。若提示「不是内部或外部命令」，说明未正确安装或未加入环境变量，请回到上方安装步骤。
                </p>
              </Step>
              <Step index={2} title="确认 ffmpeg 可用">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  输入 <code className="text-primary">ffmpeg -version</code>。若报错，高画质（1080p+）下载后将无法自动合并音视频，请先安装 ffmpeg。
                </p>
              </Step>
              <Step index={3} title="首次运行测试">
                <CmdBlock cmd="yt-dlp https://www.youtube.com/watch?v=dQw4w9WgXcQ" comment="能正常开始下载即环境就绪，按 Ctrl+C 可中止" />
              </Step>
            </div>
          </div>

          {/* 常见问题 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold text-foreground">常见问题</h3>
            </div>
            <div className="space-y-2">
              <div className="rounded-md border border-border bg-secondary/20 p-3">
                <p className="text-xs font-medium text-foreground">下载报错「HTTP Error 403」</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  多为 yt-dlp 版本过旧，请升级：<code className="text-primary">yt-dlp -U</code> 或 <code className="text-primary">pip install -U yt-dlp</code>。
                </p>
              </div>
              <div className="rounded-md border border-border bg-secondary/20 p-3">
                <p className="text-xs font-medium text-foreground">B站大会员/付费内容下载失败</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  需要登录态，在「选项配置中心 → 认证」中配置浏览器 Cookies，或使用 <code className="text-primary">--cookies-from-browser chrome</code>。
                </p>
              </div>
              <div className="rounded-md border border-border bg-secondary/20 p-3">
                <p className="text-xs font-medium text-foreground">下载很慢或失败</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  在「选项配置中心 → 网络」中配置代理（如 <code className="text-primary">--proxy socks5://127.0.0.1:1080</code>）。
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                提示：本工作台生成的命令可直接复制到终端运行。若需长期复用，可前往「预设管理」保存配置，或导出为 <Badge variant="outline" className="mx-0.5 text-[10px]">.sh</Badge>/<Badge variant="outline" className="mx-0.5 text-[10px]">.bat</Badge> 脚本。
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}