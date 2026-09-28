import { preloadServices } from '../../app/overlays';
import { cx } from '../../lib/cx';
import { usePreferences } from '../../store/preferences';
import { useUi } from '../../store/ui';

/**
 * The "Watchable now" lens (docs/phase-2-plan.md §3.5). With no services picked, the control is
 * replaced by a button into the picker — there is nothing to filter by otherwise.
 */
export function WatchableToggle() {
  const owned = usePreferences((s) => s.ownedProviders);
  const on = usePreferences((s) => s.watchableOnly);
  const setOn = usePreferences((s) => s.setWatchableOnly);
  const open = useUi((s) => s.open);

  if (owned.length === 0) {
    return (
      <button
        type="button"
        onClick={() => open('services')}
        onPointerEnter={preloadServices}
        onFocus={preloadServices}
        className="text-ink-muted text-sm underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Pick your services to see what you can watch
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          role="switch"
          aria-checked={on}
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className={cx(
            'flex h-5 w-9 shrink-0 items-center rounded-full border border-edge px-0.5 transition-colors duration-200',
            on && 'border-transparent bg-marigold',
          )}
        >
          <span
            className={cx(
              'size-3.5 rounded-full bg-ink transition-transform duration-200',
              on && 'translate-x-4 bg-on-accent',
            )}
          />
        </span>
        Watchable now
      </label>
      {on && <span className="text-ink-muted text-xs">Availability data by JustWatch.</span>}
    </div>
  );
}
