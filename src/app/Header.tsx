import { Link, NavLink } from 'react-router';
import { app } from '../../config/app.config';
import { cx } from '../lib/cx';
import { isRegion, usePreferences } from '../store/preferences';
import { useUi } from '../store/ui';
import { useWatchlist } from '../store/watchlist';
import { SearchIcon } from '../ui/icons';
import { Kbd } from '../ui/Kbd';
import { preloadPalette } from './overlays';
import { modKeyLabel } from './shortcuts';

function SearchTrigger() {
  const open = useUi((s) => s.open);
  return (
    <button
      type="button"
      onClick={() => open('palette')}
      onPointerEnter={preloadPalette}
      onFocus={preloadPalette}
      aria-label="Search films and series"
      className="flex h-9 min-w-9 items-center gap-2 rounded-sm border border-edge bg-surface px-2.5 text-sm text-ink-muted hover:border-ink-muted hover:text-ink sm:w-72 sm:px-3"
    >
      <SearchIcon className="size-4 shrink-0" />
      <span className="hidden sm:inline">Search films and series</span>
      <span className="ml-auto hidden sm:inline-flex">
        <Kbd>{modKeyLabel()} K</Kbd>
      </span>
    </button>
  );
}

function RegionSelect() {
  const region = usePreferences((s) => s.region);
  const setRegion = usePreferences((s) => s.setRegion);
  return (
    <>
      <label htmlFor="region-select" className="sr-only">
        Region for the popular list
      </label>
      <select
        id="region-select"
        value={region}
        onChange={(event) => {
          if (isRegion(event.target.value)) setRegion(event.target.value);
        }}
        title="Changes which Popular list you see"
        className="h-9 rounded-sm border border-edge bg-surface px-2 text-sm text-ink hover:border-ink-muted"
      >
        {app.regions.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </>
  );
}

export function Header() {
  const saved = useWatchlist((s) => s.items.length);
  return (
    <header className="sticky top-0 z-30 border-edge border-b bg-ground/95">
      <div className="flex h-14 items-center gap-3 px-4 sm:gap-5 sm:px-8">
        <Link to="/" className="mr-auto font-display font-semibold text-lg tracking-tight">
          {app.name}
        </Link>
        <SearchTrigger />
        <RegionSelect />
        <NavLink
          to="/watchlist"
          className={({ isActive }) =>
            cx(
              'flex h-9 items-center gap-1.5 text-sm hover:text-ink',
              isActive ? 'text-ink' : 'text-ink-muted',
            )
          }
        >
          Watchlist
          {saved > 0 && (
            <span className="tabular-nums text-ink-muted text-xs">
              <span className="sr-only">(</span>
              {saved}
              <span className="sr-only"> saved)</span>
            </span>
          )}
        </NavLink>
      </div>
    </header>
  );
}
