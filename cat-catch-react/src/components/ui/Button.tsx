import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@lib/utils';

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'danger'
  | 'ghost'
  | 'outline';
export type ButtonSize = 'sm' | 'md' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANTS: Record<ButtonVariant, string> = {
  default:
    'bg-[var(--color-surface-dim] text-[var(--color-text] hover:bg-[var(--color-border]',
  primary:
    'bg-[var(--color-primary] text-white hover:bg-[var(--color-primary-hover] active:bg-[var(--color-primary-active]',
  danger:
    'bg-[var(--color-danger] text-white hover:bg-[var(--color-danger-hover]',
  ghost: 'bg-transparent text-[var(--color-text] hover:bg-[var(--color-surface-dim]',
  outline:
    'bg-transparent border border-[var(--color-border] text-[var(--color-text] hover:bg-[var(--color-surface-dim]',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-8 px-3 text-sm',
  icon: 'h-7 w-7 p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-[--radius-md] font-medium transition-colors',
        'disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary] focus-visible:ring-offset-1',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
