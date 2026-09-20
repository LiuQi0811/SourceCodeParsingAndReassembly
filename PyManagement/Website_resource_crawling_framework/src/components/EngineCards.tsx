import { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock,
  Layers,
  PauseCircle,
  Rocket,
  RotateCcw,
  Search,
  Timer,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export interface EngineInfo {
  engine_id: string;
  state: string;
  started_at?: number;
  ended_at?: number;
  pages_crawled: number;
  max_pages: number;
  params?: {
    queue_mode?: string;
    request_delay?: number;
    concurrency?: number;
    max_depth?: number;
    allowed_domains?: string[];
    resumed_from?: string;
    urls?: string[];
  };
}

type FilterKey = 'all' | 'running' | 'finished' | 'stopped' | 'failed';

/** 状态过滤按钮组配置 */
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'running', label: '运行中' },
  { key: 'finished', label: '已完成' },
  { key: 'stopped', label: '已停止' },
  { key: 'failed', label: '失败' },
];

/** 排序权重：running 置顶，其余按启动时间倒序 */
const STATE_ORDER: Record<string, number> = { running: 0, stopped: 1, failed: 2, finished: 3 };

/** 四态视觉标签配置 */
const STATE_META: Record<
  string,
  { label: string; icon: React.ReactNode; badgeCls: string; cardCls: string; dotCls: string }
> = {
  running: {
    label: 'RUNNING',
    icon: <Rocket className="h-3.5 w-3.5" />,
    badgeCls: 'border-primary/50 text-primary bg-primary/10',
    cardCls: 'border-primary/60 shadow-[0_0_14px_hsl(var(--primary)/0.25)]',
    dotCls: 'bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]',
  },
  finished: {
    label: 'FINISHED',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    badgeCls: 'border-success/50 text-success bg-success/10',
    cardCls: 'border-success/30',
    dotCls: 'bg-success',
  },
  stopped: {
    label: 'STOPPED',
    icon: <PauseCircle className="h-3.5 w-3.5" />,
    badgeCls: 'border-muted-foreground/40 text-muted-foreground bg-muted',
    cardCls: 'border-border opacity-80',
    dotCls: 'bg-muted-foreground',
  },
  failed: {
    label: 'FAILED',
    icon: <CircleAlert className="h-3.5 w-3.5" />,
    badgeCls: 'border-destructive/50 text-destructive bg-destructive/10',
    cardCls: 'border-destructive/60',
    dotCls: 'bg-destructive',
  },
};

/** 秒数格式化：mm:ss 或 h:mm:ss */
function fmtDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface Props {
  engines: EngineInfo[];
  onStop: (engineId: string) => void;
  onResume: (engineId: string) => void;
}

export default function EngineCards({ engines, onStop, onResume }: Props) {
  const [stateFilter, setStateFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);

  // 有引擎运行时每秒触发重渲染，驱动「已运行」计时器跳动
  const hasRunning = engines.some((e) => e.state === 'running');
  useEffect(() => {
    if (!hasRunning) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [hasRunning]);
  void tick;

  // 整体空态引导
  if (!engines.length) {
    return (
      <Card className="bg-card border-primary/20 border-dashed">
        <CardContent className="p-6 text-center space-y-1">
          <Bot className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">当前无引擎实例</p>
          <p className="text-xs text-muted-foreground/70">
            在「1. 调度与双队列」配置参数后点击「启动抓取」，或终端执行 <code className="text-primary">start</code> 命令
          </p>
        </CardContent>
      </Card>
    );
  }

  const counts = engines.reduce<Record<string, number>>((acc, e) => {
    acc[e.state] = (acc[e.state] || 0) + 1;
    return acc;
  }, {});

  const q = query.trim().toLowerCase();
  const filtered = engines
    .filter((e) => stateFilter === 'all' || e.state === stateFilter)
    .filter((e) => {
      if (!q) return true;
      const hay = [
        e.engine_id,
        ...(e.params?.allowed_domains || []),
        ...(e.params?.urls || []),
        e.params?.resumed_from || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    })
    .sort(
      (a, b) =>
        (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9) ||
        (b.started_at ?? 0) - (a.started_at ?? 0)
    );

  const nowSec = Date.now() / 1000;

  return (
    <Card className="bg-card border-primary/20">
      <CardContent className="p-4 space-y-3">
        {/* 标题栏 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-bold text-primary">并行引擎实例监控</span>
            <span className="text-[10px] text-muted-foreground truncate">
              共 {engines.length} 个 · 运行中 {counts.running || 0} 个 · 随轮询自动刷新
            </span>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary text-[10px] shrink-0">
            MAX 5
          </Badge>
        </div>

        {/* 工具栏：状态过滤 + 域名搜索 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => {
              const active = stateFilter === f.key;
              const n = f.key === 'all' ? engines.length : counts[f.key] || 0;
              return (
                <button
                  type="button"
                  key={f.key}
                  onClick={() => setStateFilter(f.key)}
                  className={`h-6 px-2 rounded text-[10px] font-semibold border transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1 font-mono ${active ? 'opacity-80' : 'opacity-60'}`}>{n}</span>
                </button>
              );
            })}
          </div>
          <div className="relative w-full md:w-56 shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索域名 / URL / 引擎ID"
              className="h-7 pl-7 pr-7 text-xs bg-background border-primary/30"
            />
            {query && (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* 无匹配空态 */}
        {!filtered.length ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">无匹配的引擎实例</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStateFilter('all');
                setQuery('');
              }}
              className="h-7 text-xs"
            >
              清除筛选条件
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((e) => {
              const meta = STATE_META[e.state] || STATE_META.stopped;
              const pct = e.max_pages > 0 ? Math.min(100, Math.round((e.pages_crawled / e.max_pages) * 100)) : 0;
              const p = e.params || {};
              const running = e.state === 'running';
              const startedAt = e.started_at ? new Date(e.started_at * 1000).toLocaleTimeString() : '--';
              const duration = running && e.started_at
                ? fmtDur(nowSec - e.started_at)
                : e.started_at && e.ended_at
                  ? fmtDur(e.ended_at - e.started_at)
                  : null;
              const ended = !running;
              const resumable = ended && (e.state === 'stopped' || e.state === 'failed') && p.queue_mode === 'sqlite';
              return (
                <div
                  key={e.engine_id}
                  className={`rounded-md border bg-secondary p-3 space-y-2.5 min-w-0 transition-all duration-200 hover:shadow-md hover:border-primary/30 ${meta.cardCls}`}
                >
                  {/* 头部：engine_id + 状态徽标 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${meta.dotCls}`} />
                      <span className="font-mono text-xs text-foreground font-semibold truncate">{e.engine_id}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${meta.badgeCls}`}>
                      {meta.icon}
                      <span className="ml-1">{meta.label}</span>
                    </Badge>
                  </div>

                  {/* 启动时间 + 运行时长/总耗时 */}
                  <div className="flex items-center gap-2.5 text-[10px] font-mono flex-wrap">
                    <span className="text-muted-foreground">启动 {startedAt}</span>
                    {duration && (
                      <span
                        className={
                          running
                            ? 'text-primary font-semibold inline-flex items-center gap-0.5'
                            : 'text-muted-foreground inline-flex items-center gap-0.5'
                        }
                      >
                        {running ? (
                          <Timer className="h-2.5 w-2.5 animate-pulse" />
                        ) : (
                          <Clock className="h-2.5 w-2.5" />
                        )}
                        {running ? `已运行 ${duration}` : `总耗时 ${duration}`}
                      </span>
                    )}
                  </div>

                  {/* 进度 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">抓取进度</span>
                      <span className="text-foreground font-semibold">
                        {e.pages_crawled} / {e.max_pages || '∞'} 页 {pct > 0 && `(${pct}%)`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded ${running ? 'bg-primary animate-pulse transition-all duration-700' : 'bg-success/70'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* 参数摘要 */}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-background/60 border border-primary/15 text-accent uppercase">{p.queue_mode || '-'}</span>
                    <span className="px-1.5 py-0.5 rounded bg-background/60 border border-primary/15 text-muted-foreground">间隔 {p.request_delay ?? '-'}s</span>
                    <span className="px-1.5 py-0.5 rounded bg-background/60 border border-primary/15 text-muted-foreground">并发 {p.concurrency ?? '-'}</span>
                    <span className="px-1.5 py-0.5 rounded bg-background/60 border border-primary/15 text-muted-foreground">深度 {p.max_depth ?? '-'}</span>
                    {p.resumed_from && (
                      <span className="px-1.5 py-0.5 rounded bg-background/60 border border-accent/30 text-accent" title={`续自 ${p.resumed_from}`}>
                        ↻ 续爬
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-background/60 border border-primary/15 text-muted-foreground max-w-full truncate" title={(p.allowed_domains || []).join(', ')}>
                      <Layers className="h-2.5 w-2.5 inline mr-0.5" />
                      {(p.allowed_domains || []).join(', ') || '未限定'}
                    </span>
                  </div>

                  {/* 底部操作区 */}
                  <div className="flex items-center justify-end pt-0.5 min-h-6">
                    {running ? (
                      <Button
                        size="sm"
                        onClick={() => onStop(e.engine_id)}
                        className="h-6 px-2 text-[10px] bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
                      >
                        停止该引擎
                      </Button>
                    ) : resumable ? (
                      <Button
                        size="sm"
                        onClick={() => onResume(e.engine_id)}
                        className="h-6 px-2 text-[10px] bg-primary/80 hover:bg-primary/90 text-primary-foreground font-bold"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        一键续爬
                      </Button>
                    ) : (e.state === 'stopped' || e.state === 'failed') ? (
                      <span className="text-[10px] text-muted-foreground/60">内存队列引擎 · 不支持断点续爬</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60">已完成 · 无需续爬</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
