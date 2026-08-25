import { forwardRef } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@lib/utils';

/**
 * Slider —— radix-ui Slider 封装,样式与 Button 一致(CSS variables)
 * 用于 preview 进度条 / 音量条
 */
export const Slider = forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex items-center select-none touch-none w-full h-4',
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 grow rounded-full bg-[var(--color-border]">
      <SliderPrimitive.Range className="absolute h-full rounded-full bg-[var(--color-primary]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        'block w-3 h-3 rounded-full bg-white shadow border border-[var(--color-primary]',
        'hover:scale-125 transition-transform',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary]',
        'disabled:opacity-50 disabled:pointer-events-none',
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = 'Slider';
