import { Fragment } from 'react';
import { useUi } from '../store/ui';
import { Dialog } from '../ui/Dialog';
import { Kbd } from '../ui/Kbd';
import { shortcutList } from './shortcuts';

export default function ShortcutSheet() {
  const close = useUi((s) => s.close);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && close()}
      title="Keyboard shortcuts"
      className="p-6"
    >
      <dl className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-sm">
        {shortcutList().map((shortcut) => (
          <Fragment key={shortcut.action}>
            <dt className="flex gap-1">
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dt>
            <dd className="text-ink-muted">{shortcut.action}</dd>
          </Fragment>
        ))}
      </dl>
    </Dialog>
  );
}
