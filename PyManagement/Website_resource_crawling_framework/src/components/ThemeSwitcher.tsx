import { useState, useRef } from 'react';
import { Palette, Check, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme, ThemeId } from '@/contexts/ThemeContext';
import { toast } from 'sonner';

const PRESET_GROUPS: { label: string; items: { id: ThemeId; name: string; swatch: string }[] }[] = [
  {
    label: '企业风格（浅色）',
    items: [
      {
        id: 'antd',
        name: '企业蓝',
        swatch: 'linear-gradient(135deg, hsl(213 100% 55%), hsl(0 0% 97%))',
      },
      {
        id: 'tdesign',
        name: '商务蓝',
        swatch: 'linear-gradient(135deg, hsl(217 100% 43%), hsl(0 0% 95%))',
      },
      {
        id: 'clean',
        name: '晨雾绿',
        swatch: 'linear-gradient(135deg, hsl(168 64% 38%), hsl(210 25% 97%))',
      },
      {
        id: 'warm',
        name: '暖阳橙',
        swatch: 'linear-gradient(135deg, hsl(25 95% 53%), hsl(38 40% 97%))',
      },
    ],
  },
  {
    label: '深色主题',
    items: [
      {
        id: 'space',
        name: '深空蓝',
        swatch: 'linear-gradient(135deg, hsl(213 94% 58%), hsl(222 47% 6%))',
      },
      {
        id: 'midnight',
        name: '午夜黑',
        swatch: 'linear-gradient(135deg, hsl(213 100% 60%), hsl(0 0% 8%))',
      },
      {
        id: 'violet',
        name: '暗夜紫',
        swatch: 'linear-gradient(135deg, hsl(262 85% 66%), hsl(262 42% 7%))',
      },
      {
        id: 'terminal',
        name: '极客终端',
        swatch: 'linear-gradient(135deg, hsl(152 100% 50%), hsl(135 55% 4%))',
      },
    ],
  },
];

export default function ThemeSwitcher() {
  const { theme, customImage, setTheme, setCustomImage } = useTheme();
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const applyUrl = () => {
    const url = urlInput.trim();
    if (!url) {
      toast.error('请输入图片地址');
      return;
    }
    setCustomImage(url);
    setUrlInput('');
    toast.success('已应用自定义背景图片');
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustomImage(reader.result as string);
      toast.success('已应用自定义背景图片');
    };
    reader.onerror = () => toast.error('图片读取失败');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="text-foreground hover:bg-muted text-xs h-8 gap-1.5"
        >
          <Palette className="h-3.5 w-3.5" />
          <span className="hidden md:inline">主题</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 bg-card border-border text-foreground">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">预设主题</p>
            {PRESET_GROUPS.map((group) => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  {group.label}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {group.items.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setTheme(p.id)}
                      className={`relative rounded-md border p-1.5 transition-all ${
                        theme === p.id ? 'border-primary' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="h-10 w-full rounded" style={{ background: p.swatch }} />
                      <span className="mt-1 block text-[11px] text-muted-foreground">{p.name}</span>
                      {theme === p.id && (
                        <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-foreground mb-2">自定义背景图片</p>
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="粘贴图片 URL"
                className="bg-background border-border text-xs h-8 flex-1 min-w-0"
                onKeyDown={(e) => e.key === 'Enter' && applyUrl()}
              />
              <Button
                size="sm"
                onClick={applyUrl}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 shrink-0"
              >
                应用
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="text-foreground hover:bg-muted text-xs h-8 flex-1"
              >
                <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
                上传本地图片
              </Button>
              {customImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomImage(null);
                    toast.info('已恢复主题背景');
                  }}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs h-8 shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}