import { useConfig } from '@/contexts/ConfigContext'
import type { OptionDef } from '@/lib/yt-dlp/types'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export function OptionField({ option }: { option: OptionDef }) {
  const { config, updateField } = useConfig()
  const value = config[option.id]

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-sm font-medium text-foreground">{option.label}</Label>
          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
            {option.shortFlag ?? option.flag}
          </Badge>
        </div>
        <p className="text-xs leading-snug text-muted-foreground">{option.desc}</p>
      </div>

      <div className="w-40 shrink-0 sm:w-52">
        {option.type === 'switch' ? (
          <div className="flex justify-end">
            <Switch
              checked={Boolean(value)}
              onCheckedChange={(v) => updateField(option.id, v as never)}
            />
          </div>
        ) : option.type === 'select' ? (
          <Select
            value={String(value)}
            onValueChange={(v) => updateField(option.id, v as never)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {option.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            type={option.type === 'number' ? 'number' : 'text'}
            value={String(value ?? '')}
            placeholder={option.placeholder}
            onChange={(e) => updateField(option.id, e.target.value as never)}
            className="h-9 font-mono text-sm"
          />
        )}
      </div>
    </div>
  )
}