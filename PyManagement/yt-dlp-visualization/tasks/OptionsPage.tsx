import { getOptionsByCategory } from '@/lib/yt-dlp/optionsCatalog'
import { CATEGORY_LABELS, type OptionCategory } from '@/lib/yt-dlp/types'
import { OptionField } from '@/components/OptionField'
import { CommandPreview } from '@/components/CommandPreview'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

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

export function OptionsPage() {
  const grouped = getOptionsByCategory()

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">选项配置中心</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          完整复刻 yt-dlp 全部常用参数，可视化配置后实时生成命令行
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">参数配置</CardTitle>
            <CardDescription>按分类浏览并调整所有下载参数</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="general">
              <div className="overflow-x-auto">
                <TabsList className="mb-4 inline-flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                  {CATEGORY_ORDER.map((cat) => {
                    const opts = grouped.get(cat) ?? []
                    if (opts.length === 0) return null
                    return (
                      <TabsTrigger
                        key={cat}
                        value={cat}
                        className="h-8 rounded-md border border-border bg-background px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        {CATEGORY_LABELS[cat]}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              {CATEGORY_ORDER.map((cat) => {
                const opts = grouped.get(cat) ?? []
                if (opts.length === 0) return null
                return (
                  <TabsContent key={cat} value={cat} className="mt-0">
                    <div className="divide-y divide-border">
                      {opts.map((opt) => (
                        <OptionField key={opt.id} option={opt} />
                      ))}
                    </div>
                  </TabsContent>
                )
              })}
            </Tabs>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <CommandPreview />
        </div>
      </div>
    </div>
  )
}