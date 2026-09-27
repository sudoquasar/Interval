import { Link } from 'react-router';
import { app } from '../../../config/app.config';
import { genreRailId, popularRailId, RAIL } from '../../lib/catalog-format';
import { regionName } from '../../lib/format';
import { GENRES, genreForId } from '../../lib/genres';
import { useDocumentTitle } from '../../lib/hooks';
import { useRail } from '../../lib/queries';
import { usePreferences } from '../../store/preferences';
import { Notice } from '../../ui/Notice';
import { Rail } from '../../ui/Rail';
import { Hero } from './Hero';

function CatalogRail({
  id,
  title,
  moreHref,
  eagerCount,
}: {
  id: string;
  title: string;
  moreHref?: string;
  eagerCount?: number;
}) {
  const { data, isPending } = useRail(id);
  return (
    <Rail
      title={title}
      items={data?.items}
      loading={isPending}
      moreHref={moreHref}
      eagerCount={eagerCount}
    />
  );
}

function GenreIndex() {
  return (
    <section aria-labelledby="genre-index" className="mt-16 px-4 sm:px-8">
      <h2 id="genre-index" className="font-display font-semibold text-lg">
        Browse by genre
      </h2>
      <ul className="mt-4 columns-2 gap-8 text-sm sm:columns-3 lg:columns-5">
        {GENRES.map((genre) => (
          <li key={genre.slug} className="break-inside-avoid py-1.5">
            <Link to={`/genre/${genre.slug}`} className="text-ink-muted hover:text-ink">
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

  return (
    <>
      <h1 className="sr-only">
        {app.name}: {app.tagline.toLowerCase()}
      </h1>
      {catalogueMissing ? <MissingCatalogue /> : <Hero />}
      <CatalogRail id={RAIL.trending} title="Trending this week" eagerCount={6} />
      <CatalogRail id={popularRailId(region)} title={`Popular in ${regionName(region)}`} />
      <CatalogRail id={RAIL.newThisMonth} title="New this month" />
      <CatalogRail id={RAIL.indiaMovies} title="Indian cinema, most watched now" />
      <CatalogRail id={RAIL.indiaSeries} title="Indian series" />
      <CatalogRail id={RAIL.topMovies} title="Top rated of all time" />
      <CatalogRail id={RAIL.topSeries} title="Top rated series" />
      {app.genreRails.map((genreId) => {
        const genre = genreForId(genreId, 'movie');
        if (!genre) return null;
        return (
          <CatalogRail
            key={genreId}
            id={genreRailId(genreId)}
            title={genre.name}
            moreHref={`/genre/${genre.slug}`}
          />
        );
      })}
      <GenreIndex />
    </>
  );
}
