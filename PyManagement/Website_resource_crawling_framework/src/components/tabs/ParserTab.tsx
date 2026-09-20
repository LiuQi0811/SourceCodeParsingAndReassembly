import { FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  parserTestType: string;
  setParserTestType: (v: string) => void;
  parserInputHtml: string;
  setParserInputHtml: (v: string) => void;
  parserRules: string;
  setParserRules: (v: string) => void;
  parserResult: any;
  runParserTest: () => void;
}

export default function ParserTab({
  parserTestType,
  setParserTestType,
  parserInputHtml,
  setParserInputHtml,
  parserRules,
  setParserRules,
  parserResult,
  runParserTest,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-card border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-primary flex items-center gap-2">
              <FileCode className="h-4 w-4" />
              解析器策略选择与提取规则
            </CardTitle>
            <div className="flex gap-1">
              {['xpath', 'bs4', 'regex', 'composite'].map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant="ghost"
                  onClick={() => setParserTestType(mode)}
                  className={`h-7 px-2 text-xs uppercase font-bold ${
                    parserTestType === mode
                      ? 'bg-primary text-primary-foreground hover:bg-primary'
                      : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-muted-foreground">测试 HTML / 文本输入:</label>
            <Textarea
              rows={6}
              value={parserInputHtml}
              onChange={(e) => setParserInputHtml(e.target.value)}
              className="bg-background border-primary/30 font-mono text-[11px] text-muted-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground">提取规则定义 (JSON):</label>
            <Textarea
              rows={4}
              value={parserRules}
              onChange={(e) => setParserRules(e.target.value)}
              className="bg-background border-primary/30 font-mono text-[11px] text-primary"
            />
          </div>
          <Button onClick={runParserTest} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            执行当前解析策略 ({parserTestType.toUpperCase()})
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-primary/20 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-primary">解析结果输出 (ParseResult)</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            包含结构化字段抽取 + 自动链接发现 + 静态多媒体资源发现
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between text-xs space-y-3">
          <div className="space-y-2">
            <div className="text-[11px] text-muted-foreground">结构化数据 (Data Payload):</div>
            <pre className="p-3 rounded bg-background border border-primary/20 text-[11px] text-primary overflow-x-auto max-h-48">
              {JSON.stringify(parserResult, null, 2)}
            </pre>
          </div>
          <div className="space-y-1.5 p-2.5 rounded bg-secondary border border-primary/15 text-[11px]">
            <div className="text-accent font-bold">多策略支持特性:</div>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              <li><strong className="text-foreground">全局/单任务切换:</strong> 既可在 Engine 指定全局，也可在单个 CrawlTask 指定 parser_type。</li>
              <li><strong className="text-foreground">组合解析器 (Composite):</strong> 字段级别可混合由不同解析器分工处理。</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
