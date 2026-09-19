import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EventItem } from '@/pages/Dashboard';

interface Props {
  logs: EventItem[];
  setLogs: (v: EventItem[]) => void;
}

export default function ObserverTab({ logs, setLogs }: Props) {
  return (
    <Card className="bg-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-primary flex items-center gap-2">
            <Radio className="h-4 w-4" />
            观察者模式事件广播实时终端 (ConsoleTerminalObserver)
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLogs([])}
            className="border-primary/20 text-muted-foreground hover:text-primary text-xs h-7"
          >
            清空终端
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-card border-t border-primary/20 p-4 font-mono text-xs space-y-2 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 leading-relaxed">
              <span className="text-muted-foreground select-none">[{log.timestamp}]</span>
              <span
                className={`font-bold px-1 rounded text-[10px] select-none ${
                  log.type.includes('STARTED')
                    ? 'bg-primary/20 text-primary'
                    : log.type.includes('SUCCESS')
                    ? 'bg-info/20 text-info'
                    : log.type.includes('DECRYPT')
                    ? 'bg-accent/20 text-accent'
                    : log.type.includes('STOPPED')
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {log.type}
              </span>
              <div className="flex-1">
                <span className="text-foreground">{log.message}</span>
                {log.details && <div className="text-[11px] text-muted-foreground mt-0.5 pl-2 border-l border-primary/20">{log.details}</div>}
              </div>
            </div>
          ))}
          {logs.length === 0 && <div className="text-muted-foreground text-center py-6">暂无事件流记录</div>}
        </div>
      </CardContent>
    </Card>
  );
}
