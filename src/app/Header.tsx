import { Link, NavLink } from 'react-router';
import { app } from '../../config/app.config';
import { ServicesButton } from '../features/watch/ServicesButton';
import { cx } from '../lib/cx';
import { isRegion, usePreferences } from '../store/preferences';
import { useTheme } from '../store/theme';
import { useUi } from '../store/ui';
import { useWatchlist } from '../store/watchlist';
import { ChevronDownIcon, MoonIcon, SearchIcon, SunIcon } from '../ui/icons';
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
      className="group flex h-9 min-w-9 items-center gap-2 rounded-lg border border-edge bg-surface px-2.5 text-sm text-ink-muted transition-colors duration-200 hover:border-marigold/60 hover:text-ink sm:w-72 sm:px-3"
    >
      <SearchIcon className="size-4 shrink-0 transition-colors group-hover:text-marigold" />
      <span className="hidden sm:inline">Search films and series</span>
      <span className="ml-auto hidden sm:inline-flex">
        <Kbd>{modKeyLabel()} K</Kbd>
      </span>
    </button>
  );
}

/** A quiet text control, not a boxed <select> — one less border in a header that already has four
 * elements competing for attention. */
function RegionSelect() {
  const region = usePreferences((s) => s.region);
  const setRegion = usePreferences((s) => s.setRegion);
  return (
    <div className="relative flex h-9 items-center">
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
        className="peer h-9 cursor-pointer appearance-none bg-transparent py-1 pr-5 pl-1 text-ink-muted text-sm transition-colors hover:text-ink focus-visible:text-ink"
      >
        {app.regions.map((code) => (
          <option key={code} value={code} className="bg-surface text-ink">
            {code}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-0 size-3.5 text-ink-muted transition-colors peer-hover:text-ink" />
    </div>
  );
}

function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted transition-all duration-200 ease-snappy hover:scale-110 hover:bg-surface-high hover:text-marigold active:scale-95"
    >
      {theme === 'dark' ? (
        <MoonIcon key="moon" className="size-4 animate-scale-in" />
      ) : (
        <SunIcon key="sun" className="size-4 animate-scale-in" />
      )}
    </button>
  );
}

export function Header() {
  const saved = useWatchlist((s) => s.items.length);
  return (
    <header className="sticky top-0 z-30 border-edge border-b bg-ground/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:gap-5 sm:px-8">
        <Link
          to="/"
          className="mr-auto font-display font-semibold text-lg tracking-tight transition-colors hover:text-marigold"
        >
          {app.name}
        </Link>
        <SearchTrigger />
        <RegionSelect />
        {app.features.watchProviders && <ServicesButton />}
        <ThemeToggle />
        <NavLink
          to="/watchlist"
          className={({ isActive }) =>
            cx(
              'flex h-9 items-center gap-1.5 text-sm transition-colors hover:text-marigold',
              isActive ? 'text-ink' : 'text-ink-muted',
            )
          }
        >
          Watchlist
          {saved > 0 && (
            <span
              key={saved}
              className="inline-flex min-w-[1.25rem] animate-pop items-center justify-center rounded-full bg-coral/20 px-1.5 py-0.5 tabular-nums text-coral text-xs"
            >
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
