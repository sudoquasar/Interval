import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { app } from '../../../config/app.config';
import { cx } from '../../lib/cx';
import { formatCount } from '../../lib/format';
import { useDocumentTitle } from '../../lib/hooks';
import { type TitleSummary, titleKey } from '../../lib/model';
import { useOwnedSet, useWatchLookups } from '../../lib/providers';
import { watchableState } from '../../lib/providers-format';
import { useSearch } from '../../lib/queries';
import { TMDB_MAX_PAGE } from '../../lib/tmdb';
import { usePreferences } from '../../store/preferences';
import { SearchIcon } from '../../ui/icons';
import { Notice } from '../../ui/Notice';
import { Pagination } from '../../ui/Pagination';
import { PosterGrid, PosterGridSkeleton } from '../../ui/PosterGrid';
import { QueryError } from '../../ui/QueryError';
import { WatchableToggle } from '../watch/WatchableToggle';
import { partitionByWatchable } from './partition';

function pageFrom(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? Math.min(page, TMDB_MAX_PAGE) : 1;
}

/** Partitioned when the Watchable-now lens is on and services are set; otherwise a plain grid.
 * Nothing is ever hidden — partitioning only relabels the same results (docs/phase-2-plan.md §3.5). */
function ResultsGrid({ items }: { items: TitleSummary[] }) {
  const ownedIds = usePreferences((s) => s.ownedProviders);
  const owned = useOwnedSet(ownedIds);
  const watchableOnly = usePreferences((s) => s.watchableOnly);
  const lensOn = app.features.watchProviders && watchableOnly && ownedIds.length > 0;
  const lookups = useWatchLookups(items, app.defaultRegion, lensOn);

  if (!lensOn || lookups.pending) return <PosterGrid items={items} />;

  const states = new Map(
    items.map((item) => {
      const key = titleKey(item.type, item.id);
      return [key, watchableState(lookups.byKey.get(key), owned)] as const;
    }),
  );
  const { yes, unknown, no } = partitionByWatchable(items, states);

  return (
    <div className="flex flex-col gap-10">
      {yes.length > 0 && (
        <section aria-labelledby="watch-yes-heading">
          <h2
            id="watch-yes-heading"
            className="mb-4 font-display font-semibold text-lg text-verdigris"
          >
            On your services
          </h2>
          <PosterGrid items={yes} />
        </section>
      )}
      {unknown.length > 0 && (
        <section aria-labelledby="watch-unknown-heading">
          <h2
            id="watch-unknown-heading"
            className="mb-4 font-display font-semibold text-ink-muted text-lg"
          >
            Couldn&rsquo;t check
          </h2>
          <PosterGrid items={unknown} />
        </section>
      )}
      {no.length > 0 && (
        <section aria-labelledby="watch-no-heading">
          <h2
            id="watch-no-heading"
            className="mb-4 font-display font-semibold text-ink-muted text-lg"
          >
            Not on your services
          </h2>
          <PosterGrid items={no} />
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = pageFrom(params.get('page'));
  const region = usePreferences((s) => s.region);
  useDocumentTitle(q ? `Search: ${q}` : 'Search');

  const [input, setInput] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  // An outside change to ?q= (the palette's "See all results") replaces what is in the box.
  if (q !== syncedQ) {
    setSyncedQ(q);
    if (input.trim() !== q) setInput(q);
  }

  const debounceTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(debounceTimer.current), []);
  const onInput = (value: string) => {
    setInput(value);
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      const next = value.trim();
      setParams(next ? { q: next } : {}, { replace: true });
    }, 300);
  };

  const search = useSearch(q, page, region);
  const data = search.data;
  const hasQuery = q.trim().length >= 2;

  let body: ReactNode = null;
  if (!hasQuery) {
    body = (
      <Notice title="Type a title, a director, or an actor.">
        Hindi, Tamil and other original-language titles work too, as do English ones.
      </Notice>
    );
  } else if (search.isPending) {
    body = <PosterGridSkeleton count={12} />;
  } else if (search.isError && !data) {
    body = <QueryError error={search.error} onRetry={() => void search.refetch()} />;
  } else if (data && data.items.length === 0) {
    body = (
      <Notice
        title={
          <>
            No results for <em>{q}</em>.
          </>
        }
      >
        Try the Hindi or original-language title, check the spelling, or search by director.
      </Notice>
    );
  } else if (data) {
    body = (
      <>
        {data.people.length > 0 && (
          <p className="mb-6 text-ink-muted text-sm">
            Includes titles known for{' '}
            {data.people
              .slice(0, 3)
              .map((p) => p.name)
              .join(', ')}
            .
          </p>
        )}
        <ResultsGrid items={data.items} />
        <Pagination
          page={page}
          totalPages={data.totalPages}
          hrefFor={(n) => `/search?${new URLSearchParams({ q, page: String(n) })}`}
        />
      </>
    );
  }

  return (
    <div className="px-4 pt-10 sm:px-8">
      <h1 className="font-display font-semibold text-2xl">Search</h1>
      <form className="mt-6 max-w-xl" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="search-input" className="sr-only">
          Search films and series
        </label>
        <div className="flex h-12 items-center gap-3 rounded-lg border border-edge bg-surface px-4 transition-all duration-200 focus-within:border-marigold focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-marigold)_18%,transparent)]">
          <SearchIcon className="size-5 shrink-0 text-ink-muted" />
          <input
            id="search-input"
            type="search"
            value={input}
            onChange={(event) => onInput(event.target.value)}
            placeholder="3 Idiots, Panchayat, Christopher Nolan…"
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: the search page exists to be typed into
            autoFocus
            className="h-full w-full bg-transparent text-base placeholder:text-ink-muted focus:outline-none"
          />
        </div>
      </form>
      <p
        aria-live="polite"
        className="mt-6 flex h-6 flex-wrap items-center gap-4 text-ink-muted text-sm"
      >
        <span>
          {hasQuery && data && !search.isPlaceholderData
            ? `${formatCount(data.totalResults)} results`
            : ''}
        </span>
        {app.features.watchProviders && hasQuery && <WatchableToggle />}
      </p>
      <div className={cx('mt-4', search.isPlaceholderData && 'opacity-60')}>{body}</div>
    </div>
  );
}
