import { type SelectHTMLAttributes, useId } from 'react';
import { cx } from '../lib/cx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function Select({ label, className, children, ...props }: SelectProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-ink-muted text-xs">
        {label}
      </label>
      <select
        id={id}
        className={cx(
          'h-9 rounded-lg border border-edge bg-surface px-2 text-ink text-sm transition-colors duration-200 hover:border-marigold/60',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
