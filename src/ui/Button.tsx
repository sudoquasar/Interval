import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';
export type ButtonSize = 'md' | 'sm';

/** Shared by <Button> and by links styled as buttons, so both read as the same control. */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap',
    'transition-all duration-200 ease-snappy active:scale-[0.97]',
    'disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100',
    size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-xs',
    variant === 'primary' &&
      'bg-marigold text-on-accent shadow-[0_8px_24px_-10px_color-mix(in_oklab,var(--color-marigold)_70%,transparent)] hover:scale-[1.02] hover:brightness-110 hover:shadow-[0_10px_30px_-8px_color-mix(in_oklab,var(--color-marigold)_85%,transparent)]',
    variant === 'secondary' &&
      'border border-edge text-ink hover:border-marigold/60 hover:bg-surface-high',
    variant === 'quiet' && 'px-0 text-ink-muted underline-offset-4 hover:text-ink hover:underline',
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cx(buttonClass(variant, size), className)} {...props} />;
}
