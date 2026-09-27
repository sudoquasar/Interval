import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  hideTitle?: boolean;
  className?: string;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, title, hideTitle, className, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ground/80" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className={cx(
            'fixed top-[12vh] left-1/2 z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 rounded-sm border border-edge bg-surface focus:outline-none',
            className,
          )}
        >
          <RadixDialog.Title className={hideTitle ? 'sr-only' : 'font-display text-lg'}>
            {title}
          </RadixDialog.Title>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
