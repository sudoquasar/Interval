import { preloadServices } from '../../app/overlays';
import { usePreferences } from '../../store/preferences';
import { useUi } from '../../store/ui';
import { TvIcon } from '../../ui/icons';

/** Header trigger for the services picker (docs/phase-2-plan.md §5.1). Icon-only below `sm` so
 * the header still fits at 360px; text (with a count) once there's room. */
export function ServicesButton() {
  const open = useUi((s) => s.open);
  const count = usePreferences((s) => s.ownedProviders.length);
  const label = count > 0 ? `Your services (${count} selected)` : 'Your services';

  return (
    <button
      type="button"
      onClick={() => open('services')}
      onPointerEnter={preloadServices}
      onFocus={preloadServices}
      aria-label={label}
      title={label}
      className="flex h-9 items-center gap-1.5 rounded-full px-1.5 text-ink-muted text-sm transition-colors hover:text-marigold sm:px-2"
    >
      <TvIcon className="size-4 sm:hidden" />
      <span className="hidden sm:inline">Your services{count > 0 ? ` (${count})` : ''}</span>
    </button>
  );
}
