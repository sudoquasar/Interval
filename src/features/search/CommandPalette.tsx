import { Command } from 'cmdk';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { app } from '../../../config/app.config';
import { regionName } from '../../lib/format';
import { GENRES } from '../../lib/genres';
import { useDebouncedValue } from '../../lib/hooks';
import { tmdbImage } from '../../lib/images';
import { titlePath } from '../../lib/model';
import { useSearch } from '../../lib/queries';
import { MissingTokenError } from '../../lib/tmdb';
import { usePreferences } from '../../store/preferences';
import { useUi } from '../../store/ui';
import { Dialog } from '../../ui/Dialog';
import { CheckIcon, SearchIcon } from '../../ui/icons';
import { typeLabel } from '../../ui/PosterCard';

const ITEM =
  'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink transition-colors duration-150 data-[selected=true]:bg-marigold/15';
const GROUP =
  'mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-ink-muted [&_[cmdk-group-heading]]:text-xs';

function matches(text: string, query: string): boolean {
  return query === '' || text.toLowerCase().includes(query);
}

export default function CommandPalette() {
  const open = useUi((s) => s.overlay === 'palette');
  const close = useUi((s) => s.close);
  const showShortcuts = useUi((s) => s.open);
  const region = usePreferences((s) => s.region);
  const setRegion = usePreferences((s) => s.setRegion);
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setQuery('');
  }

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const debounced = useDebouncedValue(trimmed, 300);
  const search = useSearch(debounced, 1, region);
  const searching = trimmed.length >= 2;
  const settled = debounced === trimmed && !search.isFetching;
  const titles = searching ? (search.data?.items ?? []).slice(0, 8) : [];

  const go = (to: string) => {
    close();
    navigate(to);
  };

  const genres = GENRES.filter((g) => matches(g.name, needle)).slice(0, needle ? 4 : GENRES.length);
  const regions = app.regions.filter(
    (code) => !needle || matches(`popular ${regionName(code)} region ${code}`, needle),
  );
  const pages = [
    { label: 'Home', run: () => go('/') },
    { label: 'Watchlist', run: () => go('/watchlist') },
    { label: 'Keyboard shortcuts', run: () => showShortcuts('shortcuts') },
  ].filter((p) => matches(p.label, needle));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      title="Search and commands"
      hideTitle
      className="top-[10vh] overflow-hidden"
    >
      <Command shouldFilter={false} loop label="Search and commands">
        <div className="flex items-center gap-3 border-edge border-b px-4">
          <SearchIcon className="size-4 shrink-0 text-ink-muted" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search a title, a director, or a genre"
            className="h-14 w-full bg-transparent text-base text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </div>
        <Command.List className="scrollbar-quiet max-h-[min(60vh,28rem)] overflow-y-auto p-2">
          {searching && !settled && titles.length === 0 && (
            <Command.Loading>
              <p className="px-2 py-3 text-ink-muted text-sm">Searching TMDB…</p>
            </Command.Loading>
          )}
          {searching && settled && search.isError && (
            <p className="px-2 py-3 text-ink-muted text-sm">
              {search.error instanceof MissingTokenError
                ? 'Search needs a TMDB token. Add VITE_TMDB_READ_TOKEN to .env.local.'
                : 'TMDB did not answer. Check your connection and try again.'}
            </p>
          )}
          {settled && (
            <Command.Empty className="px-2 py-3 text-ink-muted text-sm">
              Nothing matches &ldquo;{trimmed}&rdquo;. Try the original-language title, or a
              director&rsquo;s name.
            </Command.Empty>
          )}

          {titles.length > 0 && (
            <Command.Group heading="Titles" className={GROUP}>
              {titles.map((title) => (
                <Command.Item
                  key={`${title.type}-${title.id}`}
                  value={`title-${title.type}-${title.id}`}
                  onSelect={() => go(titlePath(title))}
                  className={ITEM}
                >
                  <span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded-sm bg-edge">
                    {title.poster && (
                      <img
                        src={tmdbImage(title.poster, 'w92') ?? undefined}
                        alt=""
                        width={32}
                        height={48}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display">{title.title}</span>
                    <span className="block text-ink-muted text-xs">
                      {title.year ? `${title.year} · ` : ''}
                      {typeLabel(title)}
                    </span>
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {searching && (
            <Command.Group heading="Search" className={GROUP}>
              <Command.Item
                value="see-all-results"
                onSelect={() => go(`/search?q=${encodeURIComponent(trimmed)}`)}
                className={ITEM}
              >
                <SearchIcon className="size-4 text-ink-muted" />
                See all results for &ldquo;{trimmed}&rdquo;
              </Command.Item>
            </Command.Group>
          )}

          {genres.length > 0 && (
            <Command.Group heading="Genres" className={GROUP}>
              {genres.map((genre) => (
                <Command.Item
                  key={genre.slug}
                  value={`genre-${genre.slug}`}
                  onSelect={() => go(`/genre/${genre.slug}`)}
                  className={ITEM}
                >
                  {genre.name}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {regions.length > 0 && (
            <Command.Group heading="Popular list region" className={GROUP}>
              {regions.map((code) => (
                <Command.Item
                  key={code}
                  value={`region-${code}`}
                  onSelect={() => {
                    setRegion(code);
                    close();
                  }}
                  className={ITEM}
                >
                  <span className="w-4">
                    {code === region && <CheckIcon className="size-4 text-marigold" />}
                  </span>
                  Popular in {regionName(code)}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {pages.length > 0 && (
            <Command.Group heading="Go to" className={GROUP}>
              {pages.map((page) => (
                <Command.Item
                  key={page.label}
                  value={`page-${page.label}`}
                  onSelect={page.run}
                  className={ITEM}
                >
                  {page.label}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </Dialog>
  );
}
