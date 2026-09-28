import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-edge px-1 font-sans text-[0.6875rem] text-ink-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
