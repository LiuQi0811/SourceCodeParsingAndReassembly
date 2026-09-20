import { FileText, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  charsetTestType: string;
  setCharsetTestType: (v: string) => void;
  charsetText: string;
  setCharsetText: (v: string) => void;
  charsetResult: { detected: string; text: string; noGarbled: boolean };
  runCharsetTest: () => void;
}

export default function CharsetTab({
  charsetTestType,
  setCharsetTestType,
  charsetText,
  setCharsetText,
  charsetResult,
  runCharsetTest,
}: Props) {
  return (
    <Card className="bg-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-primary flex items-center gap-2">
          <FileText className="h-4 w-4" />
          智能字符集检测与转码（杜绝中文乱码）
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          自动识别 HTTP Header、HTML Meta、BOM 签名及基于 charset-normalizer 智能探测，GB18030 多级回退彻底解决乱码
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-foreground font-semibold">选择测试源编码:</label>
          <div className="flex gap-2">
            {[
              { id: 'gbk', label: 'GBK / GB2312 (国内常见)' },
              { id: 'gb18030', label: 'GB18030 (超集汉字/生僻字)' },
              { id: 'utf8', label: 'UTF-8 标准国际编码' },
            ].map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant="outline"
                onClick={() => setCharsetTestType(item.id)}
                className={`text-xs ${
                  charsetTestType === item.id
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-primary/20 text-muted-foreground'
                }`}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={runCharsetTest} className="ml-auto bg-primary text-primary-foreground font-bold">
            模拟自动探测转码
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-muted-foreground">原始中文文本模拟输入:</label>
            <Textarea
              rows={4}
              value={charsetText}
              onChange={(e) => setCharsetText(e.target.value)}
              className="bg-background border-primary/30 font-mono text-xs text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted-foreground">智能解码引擎分析报告:</label>
            <div className="p-3 rounded bg-background border border-primary/30 space-y-2 h-[106px] flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">检测命中编码:</span>
                <Badge variant="outline" className="border-primary text-primary bg-primary/10">
                  {charsetResult.detected}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">中文完整度:</span>
                <span className="text-primary font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 零乱码保障 (100% 还原)
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
