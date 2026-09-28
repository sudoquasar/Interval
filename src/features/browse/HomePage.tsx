import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { app } from '../../../config/app.config';
import { accentHoverClass } from '../../lib/accents';
import { popularRailId, RAIL } from '../../lib/catalog-format';
import { cx } from '../../lib/cx';
import { regionName } from '../../lib/format';
import { GENRES } from '../../lib/genres';
import { useDocumentTitle } from '../../lib/hooks';
import { useOwnedSet } from '../../lib/providers';
import { isWatchableWith } from '../../lib/providers-format';
import { useRail } from '../../lib/queries';
import { usePreferences } from '../../store/preferences';
import { Notice } from '../../ui/Notice';
import { Rail } from '../../ui/Rail';
import { WatchableToggle } from '../watch/WatchableToggle';
import { DiscoverBar } from './DiscoverBar';
import { Hero } from './Hero';

function CatalogRail({
  id,
  title,
  moreHref,
  eagerCount,
  limit,
  watchActive,
  owned,
  onEmptyChange,
}: {
  id: string;
  title: string;
  moreHref?: string;
  eagerCount?: number;
  /** Home rails show a curated slice, not the full stored list — the page is a taster, not a wall.
   * Skipped while the Watchable-now lens is active, since matches are already sparse. */
  limit?: number;
  watchActive: boolean;
  owned: ReadonlySet<number>;
  onEmptyChange: (id: string, empty: boolean) => void;
}) {
  const { data, isPending } = useRail(id);
  const items = useMemo(() => {
    if (!data) return undefined;
    const source = watchActive
      ? data.items.filter((item) => isWatchableWith(item.watch, owned))
      : data.items;
    return limit && !watchActive ? source.slice(0, limit) : source;
  }, [data, watchActive, owned, limit]);

  useEffect(() => {
    onEmptyChange(id, watchActive && items !== undefined && items.length === 0);
  }, [id, watchActive, items, onEmptyChange]);

  return (
    <Rail
      title={title}
      items={items}
      loading={isPending}
      moreHref={moreHref}
      eagerCount={eagerCount}
    />
  );
}

function GenreIndex() {
  return (
    <section aria-labelledby="genre-index" className="mt-20 px-4 sm:px-8">
      <h2 id="genre-index" className="font-display font-semibold text-lg">
        Or just pick a mood
      </h2>
      <ul className="mt-5 flex flex-wrap gap-2.5">
        {GENRES.map((genre, index) => (
          <li key={genre.slug}>
            <Link
              to={`/genre/${genre.slug}`}
              className={cx(
                'inline-block rounded-full border border-edge px-3.5 py-1.5 text-ink-muted text-sm transition-all duration-200 ease-snappy hover:scale-105',
                accentHoverClass(index),
              )}
            >
              {genre.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MissingCatalogue() {
  return (
    <div className="px-4 sm:px-8">
      <Notice title="The catalogue has not been built yet.">
        <p>
          Run <code>pnpm data:catalog</code> with a TMDB token to build it locally, or{' '}
          <code>pnpm data:pull</code> to fetch what the nightly job last published. Search and title
          pages work without it.
        </p>
      </Notice>
    </div>
  );
}

export function HomePage() {
  useDocumentTitle(null);
  const region = usePreferences((s) => s.region);
  const trending = useRail(RAIL.trending);
  const catalogueMissing = trending.isSuccess && trending.data === null;
  const [discoverActive, setDiscoverActive] = useState(false);

  const ownedIds = usePreferences((s) => s.ownedProviders);
  const owned = useOwnedSet(ownedIds);
  const watchableOnly = usePreferences((s) => s.watchableOnly);
  const watchActive = app.features.watchProviders && watchableOnly && ownedIds.length > 0;

  const railIds = useMemo(
    () => [
      RAIL.trending,
      popularRailId(region),
      RAIL.newThisMonth,
      RAIL.indiaMovies,
      RAIL.indiaSeries,
      RAIL.topMovies,
    ],
    [region],
  );
  const [emptyRails, setEmptyRails] = useState<Record<string, boolean>>({});
  const onEmptyChange = useCallback((id: string, empty: boolean) => {
    setEmptyRails((prev) => (prev[id] === empty ? prev : { ...prev, [id]: empty }));
  }, []);
  const allRailsEmpty = watchActive && railIds.every((id) => emptyRails[id] === true);

  return (
    <>
      <h1 className="sr-only">
        {app.name}: {app.tagline.toLowerCase()}
      </h1>
      {catalogueMissing ? <MissingCatalogue /> : <Hero />}
      <DiscoverBar onActiveChange={setDiscoverActive} />
      {app.features.watchProviders && (
        <div className="mt-8 px-4 sm:px-8">
          <WatchableToggle />
        </div>
      )}
      {!discoverActive &&
        (allRailsEmpty ? (
          <div className="px-4 sm:px-8">
            <Notice title="Nothing in tonight's rails is on your services.">
              Genre pages search the whole catalogue: try one below.
            </Notice>
          </div>
        ) : (
          <>
            <CatalogRail
              id={RAIL.trending}
              title="Everyone's already seen this"
              eagerCount={4}
              limit={10}
              watchActive={watchActive}
              owned={owned}
              onEmptyChange={onEmptyChange}
            />
            <CatalogRail
              id={popularRailId(region)}
              title={`What ${regionName(region)} can't stop watching`}
              limit={10}
              watchActive={watchActive}
              owned={owned}
              onEmptyChange={onEmptyChange}
            />
            <CatalogRail
              id={RAIL.newThisMonth}
              title="Hot off the reel"
              limit={10}
              watchActive={watchActive}
              owned={owned}
              onEmptyChange={onEmptyChange}
            />
            <CatalogRail
              id={RAIL.indiaMovies}
              title="India's current obsessions"
              limit={10}
              watchActive={watchActive}
              owned={owned}
              onEmptyChange={onEmptyChange}
            />
            <CatalogRail
              id={RAIL.indiaSeries}
              title="Shows to lose a weekend to"
              limit={10}
              watchActive={watchActive}
              owned={owned}
              onEmptyChange={onEmptyChange}
            />
            <CatalogRail
              id={RAIL.topMovies}
              title="The ones everyone pretends they've seen"
              limit={8}
              watchActive={watchActive}
              owned={owned}
              onEmptyChange={onEmptyChange}
            />
          </>
        ))}
      <GenreIndex />
    </>
  );
}
