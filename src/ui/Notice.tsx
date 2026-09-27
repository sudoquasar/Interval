import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

/**
 * Empty and error states. Written as directions, not apologies (PLAN.md §6.3): the title says
 * what happened, the body says what to do next.
 */
export function Notice({
  title,
  children,
  action,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('measure py-12', className)}>
      <p className="font-display text-xl">{title}</p>
      {children && <div className="mt-2 text-ink-muted">{children}</div>}
      {action && <div className="mt-6 flex flex-wrap gap-3">{action}</div>}
    </div>
  );
}
