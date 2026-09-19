import {
  Cpu,
  RotateCcw,
  CheckCircle2,
  Check,
  Copy,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  backendOnline: boolean | null;
  backendUrl: string;
  setBackendUrl: (v: string) => void;
  checkBackend: () => Promise<boolean>;
  queueMode: 'memory' | 'sqlite';
  setQueueMode: (m: 'memory' | 'sqlite') => void;
  handleResumeBreakpoint: () => void;
  targetUrls: string;
  setTargetUrls: (v: string) => void;
  concurrency: number;
  setConcurrency: (v: number) => void;
  requestDelay: number;
  setRequestDelay: (v: number) => void;
  maxDepth: number;
  setMaxDepth: (v: number) => void;
  maxPages: number;
  setMaxPages: (v: number) => void;
  defaultParser: string;
  setDefaultParser: (v: string) => void;
  autoFollowPagination: boolean;
  setAutoFollowPagination: (v: boolean) => void;
  sameDomainOnly: boolean;
  setSameDomainOnly: (v: boolean) => void;
  copied: boolean;
  copyCode: (code: string) => void;
}

export default function ControlTab(props: Props) {
  const {
    backendOnline,
    backendUrl,
    setBackendUrl,
    checkBackend,
    queueMode,
    setQueueMode,
    handleResumeBreakpoint,
    targetUrls,
    setTargetUrls,
    concurrency,
    setConcurrency,
    requestDelay,
    setRequestDelay,
    maxDepth,
    setMaxDepth,
    maxPages,
    setMaxPages,
    defaultParser,
    setDefaultParser,
    autoFollowPagination,
    setAutoFollowPagination,
    sameDomainOnly,
    setSameDomainOnly,
    copied,
    copyCode,
  } = props;

  return (
    <>
      {/* 真实抓取引导条 */}
      <div className="p-3 rounded border border-primary/30 bg-secondary text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1 rounded bg-primary/10 border border-primary/40 text-primary mt-0.5">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary">真实全站抓取引擎</span>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px] bg-primary/5">
                {backendOnline ? 'ONLINE 服务端真实请求' : 'OFFLINE 服务未运行'}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5">
              填写目标网址后点击右上角【启动抓取】，引擎将通过服务端真实请求目标站点、智能识别字符集（GBK/GB18030/UTF-8）并解析提取真实的图片/视频/音频资源。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={checkBackend}
            className="border-primary/30 text-primary hover:bg-primary/10 text-xs h-7"
          >
            重新检测服务
          </Button>
        </div>
      </div>

      {/* 后端服务配置面板 */}
      <div className="p-3.5 rounded border border-primary/30 bg-background text-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">Python 抓取服务配置</span>
          <span className="text-muted-foreground">服务端负责真实请求目标站点并解析资源</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="http://localhost:8000"
            className="bg-card border-primary/30 text-xs font-mono h-8"
          />
          <Button
            size="sm"
            onClick={checkBackend}
            className="bg-primary hover:bg-primary/90 text-background font-bold text-xs h-8 shrink-0"
          >
            检测连接
          </Button>
        </div>
        <div className="text-[11px] text-muted-foreground">
          本地服务端启动命令：<code className="text-primary">python3 server.py</code> (默认端口 8000)
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-primary/20 md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-primary flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  全站异步抓取任务配置
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  支持内存队列与SQLite持久化队列自由切换，支持断点续爬
                </CardDescription>
              </div>
              {queueMode === 'sqlite' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResumeBreakpoint}
                  className="border-accent/40 text-accent hover:bg-accent/10 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  恢复断点续爬
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {/* 队列模式单选切换 */}
            <div className="space-y-2">
              <label className="font-semibold text-foreground">1. 队列调度策略 (Strategy Pattern):</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  onClick={() => setQueueMode('memory')}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    queueMode === 'memory'
                      ? 'border-primary bg-primary/10 shadow-[0_0_10px_hsl(var(--primary) / 0.1)]'
                      : 'border-primary/20 hover:border-primary/40 bg-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">① 一次性内存队列 (Memory)</span>
                    {queueMode === 'memory' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    预先一次性加载全部URL进内存异步队列，内存去重，极致吞吐，适合轻量全量任务。
                  </p>
                </div>

                <div
                  onClick={() => setQueueMode('sqlite')}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    queueMode === 'sqlite'
                      ? 'border-accent bg-accent/10 shadow-[0_0_10px_hsl(var(--accent) / 0.1)]'
                      : 'border-primary/20 hover:border-primary/40 bg-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">② SQLite 持久化队列 (断点续爬)</span>
                    {queueMode === 'sqlite' && <CheckCircle2 className="h-4 w-4 text-accent" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    边抓取边发现并写入 SQLite，WAL 高并发模式，进程异常中断可无缝断点续爬。
                  </p>
                </div>
              </div>
            </div>

            {/* 种子目标 URL */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">2. 抓取种子 URL (每行一个):</label>
              <Textarea
                rows={3}
                value={targetUrls}
                onChange={(e) => setTargetUrls(e.target.value)}
                placeholder="https://example.com"
                className="bg-background border-primary/30 font-mono text-xs text-primary focus-visible:ring-[hsl(var(--primary))]"
              />
            </div>

            {/* 全站抓取与翻页参数配置 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <label className="text-muted-foreground">并发 Worker 数:</label>
                <Input
                  type="number"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="bg-background border-primary/30 font-mono text-xs text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">域名请求间隔(秒)防封禁:</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={requestDelay}
                  onChange={(e) => setRequestDelay(Number(e.target.value))}
                  className="bg-background border-primary/30 font-mono text-xs text-accent"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">最大抓取递归深度:</label>
                <Input
                  type="number"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="bg-background border-primary/30 font-mono text-xs text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">抓取页面上限 (Max Pages):</label>
                <Input
                  type="number"
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="bg-background border-primary/30 font-mono text-xs text-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">默认解析器 (Factory):</label>
                <select
                  value={defaultParser}
                  onChange={(e) => setDefaultParser(e.target.value)}
                  className="w-full h-9 rounded bg-background border border-primary/30 font-mono text-xs text-foreground px-2 focus:outline-none focus:border-primary"
                >
                  <option value="xpath">XPath (lxml 高性能解析)</option>
                  <option value="bs4">BeautifulSoup4 (DOM容错)</option>
                  <option value="regex">Regex (正则快速抽取)</option>
                  <option value="composite">Composite (组合解析器)</option>
                </select>
              </div>
            </div>

            {/* 通用全站与翻页高级开关 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-primary/10">
              <label className="flex items-center gap-2 text-foreground cursor-pointer bg-background p-2.5 rounded border border-primary/20 hover:border-primary/40">
                <input
                  type="checkbox"
                  checked={autoFollowPagination}
                  onChange={(e) => setAutoFollowPagination(e.target.checked)}
                  className="rounded accent-[hsl(var(--primary))] h-4 w-4"
                />
                <div>
                  <div className="font-semibold text-xs text-primary">★ 智能通用翻页识别 (Pagination Follow)</div>
                  <div className="text-[10px] text-muted-foreground">自动识别下一页、页码列表、page=N、/list_N/、rel=next 并赋予高优先级优先翻页</div>
                </div>
              </label>

              <label className="flex items-center gap-2 text-foreground cursor-pointer bg-background p-2.5 rounded border border-primary/20 hover:border-primary/40">
                <input
                  type="checkbox"
                  checked={sameDomainOnly}
                  onChange={(e) => setSameDomainOnly(e.target.checked)}
                  className="rounded accent-[hsl(var(--primary))] h-4 w-4"
                />
                <div>
                  <div className="font-semibold text-xs text-primary">同源主域限定 (Same-Domain Bound)</div>
                  <div className="text-[10px] text-muted-foreground">仅在种子站点的根域名内深度扩展，严格过滤外部友链和推广网址</div>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 代码调用架构示意 */}
        <Card className="bg-card border-primary/20 flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-primary">Python 引擎调用范式</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  copyCode(`from crawler_framework import CrawlerEngine\n\nengine = CrawlerEngine(\n    queue_mode="${queueMode}",\n    default_parser="${defaultParser}",\n    concurrency=${concurrency}\n)\nawait engine.add_url("${targetUrls.split('\\n')[0]}")\nawait engine.run()`)
                }
                className="h-7 px-2 text-muted-foreground hover:text-primary"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between text-xs">
            <pre className="p-2.5 rounded bg-background border border-primary/20 text-[11px] leading-relaxed text-muted-foreground overflow-x-auto">
              <code>
                <span className="text-primary">from</span> crawler_framework <span className="text-primary">import</span> CrawlerEngine{'\n\n'}
                <span className="text-muted-foreground"># 策略工厂自动实例化</span>{'\n'}
                engine = CrawlerEngine({'\n'}
                {'  '}queue_mode=<span className="text-accent">"{queueMode}"</span>,{'\n'}
                {'  '}default_parser=<span className="text-info">"{defaultParser}"</span>,{'\n'}
                {'  '}concurrency=<span className="text-foreground">{concurrency}</span>{'\n'}
                ){'\n\n'}
                <span className="text-muted-foreground"># 投递种子并启动全站调度</span>{'\n'}
                <span className="text-primary">await</span> engine.add_url({'\n'}
                {'  '}<span className="text-accent">"{targetUrls.split('\n')[0]}"</span>{'\n'}
                ){'\n'}
                <span className="text-primary">await</span> engine.run()
              </code>
            </pre>
            <div className="mt-3 p-2 rounded bg-secondary border border-primary/15 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 text-primary font-bold">
                <Sparkles className="h-3.5 w-3.5" />
                断点续爬机制说明:
              </div>
              SQLite模式下任务执行即标记 processing，完成即 completed；退出重启自动执行 <code className="text-accent">reset_processing()</code>，免去从零开始！
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
