import { useState } from 'react';
import { Link } from 'react-router';
import { app } from '../../../config/app.config';
import { accentHoverClass } from '../../lib/accents';
import { popularRailId, RAIL } from '../../lib/catalog-format';
import { cx } from '../../lib/cx';
import { regionName } from '../../lib/format';
import { GENRES } from '../../lib/genres';
import { useDocumentTitle } from '../../lib/hooks';
import { useRail } from '../../lib/queries';
import { usePreferences } from '../../store/preferences';
import { Notice } from '../../ui/Notice';
import { Rail } from '../../ui/Rail';
import { DiscoverBar } from './DiscoverBar';
import { Hero } from './Hero';

function CatalogRail({
  id,
  title,
  moreHref,
  eagerCount,
  limit,
}: {
  id: string;
  title: string;
  moreHref?: string;
  eagerCount?: number;
  /** Home rails show a curated slice, not the full stored list — the page is a taster, not a wall. */
  limit?: number;
}) {
  const { data, isPending } = useRail(id);
  const items = limit ? data?.items.slice(0, limit) : data?.items;
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

  return (
    <>
      <h1 className="sr-only">
        {app.name}: {app.tagline.toLowerCase()}
      </h1>
      {catalogueMissing ? <MissingCatalogue /> : <Hero />}
      <DiscoverBar onActiveChange={setDiscoverActive} />
      {!discoverActive && (
        <>
          <CatalogRail
            id={RAIL.trending}
            title="Everyone's already seen this"
            eagerCount={4}
            limit={10}
          />
          <CatalogRail
            id={popularRailId(region)}
            title={`What ${regionName(region)} can't stop watching`}
            limit={10}
          />
          <CatalogRail id={RAIL.newThisMonth} title="Hot off the reel" limit={10} />
          <CatalogRail id={RAIL.indiaMovies} title="India's current obsessions" limit={10} />
          <CatalogRail id={RAIL.indiaSeries} title="Shows to lose a weekend to" limit={10} />
          <CatalogRail
            id={RAIL.topMovies}
            title="The ones everyone pretends they've seen"
            limit={8}
          />
        </>
      )}
      <GenreIndex />
    </>
  );
}
