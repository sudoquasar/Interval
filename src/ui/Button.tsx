import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';
export type ButtonSize = 'md' | 'sm';

/** Shared by <Button> and by links styled as buttons, so both read as the same control. */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap',
    'disabled:pointer-events-none disabled:opacity-50',
    size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-xs',
    variant === 'primary' && 'bg-marigold text-ground hover:brightness-110',
    variant === 'secondary' &&
      'border border-edge text-ink hover:border-ink-muted hover:bg-surface',
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
