import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CommandDef {
  description: string;
  usage?: string;
  /** 参数候选值：按已有参数返回可选补全列表 */
  completions?: (args: string[]) => string[];
  /** emit 用于长时间任务实时回显中间输出 */
  run: (
    args: string[],
    emit: (text: string) => void,
  ) => Promise<string[] | string> | string[] | string;
}

export interface CommandRegistry {
  [name: string]: CommandDef;
}

type LineType = 'input' | 'output' | 'error' | 'system';

interface Line {
  id: string;
  type: LineType;
  text: string;
}

interface Props {
  commands: CommandRegistry;
}

const BANNER = [
  'ASYNC CRAWLER CORE — 命令控制台 v1.0',
  '输入 help 查看可用指令，clear 清屏，↑/↓ 切换历史命令',
];

export default function CommandConsole({ commands }: Props) {
  const [lines, setLines] = useState<Line[]>(() =>
    BANNER.map((text, i) => ({ id: `banner-${i}`, type: 'system' as LineType, text })),
  );
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const pushLines = useCallback((type: LineType, texts: string[]) => {
    setLines((prev) => [
      ...prev,
      ...texts.map((text, i) => ({ id: `${type}-${Date.now()}-${i}-${Math.random()}`, type, text })),
    ]);
  }, []);

  const runCommand = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      pushLines('input', [`crawler@core:~$ ${trimmed}`]);
      if (!trimmed) return;

      setHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);

      const parts = trimmed.split(/\s+/);
      const name = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (name === 'clear') {
        setLines([]);
        return;
      }

      const cmd = commands[name];
      if (!cmd) {
        pushLines('error', [
          `command not found: ${name}`,
          '输入 help 查看可用指令列表',
        ]);
        return;
      }

      try {
        const result = await cmd.run(args, (text: string) => pushLines('output', [text]));
        const out = Array.isArray(result) ? result : [result];
        if (out.length) pushLines('output', out);
      } catch (e: any) {
        pushLines('error', [`执行出错: ${e?.message || '未知错误'}`]);
      }
    },
    [commands, pushLines],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runCommand(input);
    setInput('');
  };

  // Tab 自动补全：命令名 / 参数候选值
  const completeFragment = useCallback(
    (fragment: string, candidates: string[]) => {
      if (!candidates.length) return;
      const base = input.slice(0, input.length - fragment.length);
      if (candidates.length === 1) {
        setInput(base + candidates[0] + ' ');
        return;
      }
      let prefix = candidates[0];
      for (const c of candidates) {
        while (prefix && !c.startsWith(prefix)) prefix = prefix.slice(0, -1);
      }
      pushLines('system', [candidates.join('   ')]);
      if (prefix.length > fragment.length) setInput(base + prefix);
    },
    [input, pushLines],
  );

  const onTabComplete = useCallback(() => {
    const trailingEmpty = /\s$/.test(input);
    const parts = input.split(/\s+/);
    // 仅一个词且未以空格结尾：补全命令名
    if (parts.length === 1 && !trailingEmpty) {
      const fragment = parts[0] ?? '';
      const candidates = [...Object.keys(commands), 'clear'].filter((c) =>
        c.startsWith(fragment),
      );
      completeFragment(fragment, candidates);
      return;
    }
    // 参数补全：取命令的候选值
    const name = (parts[0] ?? '').toLowerCase();
    const cmd = commands[name];
    const fragment = trailingEmpty ? '' : (parts[parts.length - 1] ?? '');
    const priorArgs = trailingEmpty ? parts.slice(1) : parts.slice(1, -1);
    let candidates: string[] = [];
    if (cmd?.completions) {
      candidates = cmd.completions(priorArgs).filter((c) => c.startsWith(fragment));
    }
    completeFragment(fragment, candidates);
  }, [commands, input, completeFragment]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      onTabComplete();
      return;
    }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      setLines([]);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const next = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    }
  };

  return (
    <div
      className="terminal-panel flex flex-col h-[calc(100vh-220px)] min-h-[360px]"
      onClick={() => inputRef.current?.focus()}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-primary tracking-wider">COMMAND CONSOLE</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLines([])}
          className="text-muted-foreground hover:text-foreground hover:bg-muted h-7 text-xs"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          清屏
        </Button>
      </div>

      {/* 输出区 */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed space-y-0.5"
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={
              line.type === 'input'
                ? 'text-primary'
                : line.type === 'error'
                  ? 'text-destructive'
                  : line.type === 'system'
                    ? 'text-info'
                    : 'text-foreground/90'
            }
          >
            {line.type === 'input' ? (
              <span className="break-all">{line.text}</span>
            ) : (
              <span className="break-all whitespace-pre-wrap">{line.text}</span>
            )}
          </div>
        ))}
      </div>

      {/* 输入行 */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 px-4 py-2.5 border-t border-border/60 shrink-0">
        <span className="text-primary font-mono text-xs shrink-0 select-none">crawler@core:~$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
          placeholder="输入命令后按 Enter 执行，Tab 补全，help 查看指令"
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs font-mono text-foreground placeholder:text-muted-foreground caret-primary"
          autoFocus
        />
      </form>
    </div>
  );
}