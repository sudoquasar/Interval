import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { NotFound } from '../../app/NotFound';
import { formatDate, formatRuntime, languageName, titleStretch } from '../../lib/format';
import { genreForId } from '../../lib/genres';
import { useDocumentTitle } from '../../lib/hooks';
import { tmdbImage } from '../../lib/images';
import type { MediaType, TitleDetail } from '../../lib/model';
import { useTitle } from '../../lib/queries';
import { useRatings } from '../../lib/ratings';
import { toCardScores } from '../../lib/ratings-format';
import { TmdbError } from '../../lib/tmdb';
import { buttonClass } from '../../ui/Button';
import { ArrowLeftIcon, ExternalIcon } from '../../ui/icons';
import { Notice } from '../../ui/Notice';
import { typeLabel } from '../../ui/PosterCard';
import { PosterImage } from '../../ui/PosterImage';
import { QueryError } from '../../ui/QueryError';
import { Rail } from '../../ui/Rail';
import { Scorecard } from '../../ui/Scorecard';
import { WatchlistButton } from '../watchlist/WatchlistButton';

const COLUMNS =
  'grid gap-8 md:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-14';
const POSTER_COLUMN = 'w-40 sm:w-52 md:sticky md:top-20 md:w-auto md:self-start';

function yearSpan(detail: TitleDetail): string | null {
  if (!detail.year) return null;
  if (detail.type === 'movie') return String(detail.year);
  if (detail.ongoing) return `${detail.year}–`;
  if (detail.endYear && detail.endYear !== detail.year) return `${detail.year}–${detail.endYear}`;
  return String(detail.year);
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function BackLink() {
  const location = useLocation();
  const navigate = useNavigate();
  const className =
    'inline-flex items-center gap-2 text-ink-muted text-sm hover:text-ink focus-visible:text-ink';
  if (location.key !== 'default') {
    return (
      <button type="button" onClick={() => navigate(-1)} className={className}>
        <ArrowLeftIcon className="size-4" />
        Back
      </button>
    );
  }
  return (
    <Link to="/" className={className}>
      <ArrowLeftIcon className="size-4" />
      Home
    </Link>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function TitleContent({ detail }: { detail: TitleDetail }) {
  const ratings = useRatings(detail.imdb);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const record = ratings.status === 'ready' ? ratings.record : null;
  const isMovie = detail.type === 'movie';
  const language = languageName(detail.lang);
  const runtime = formatRuntime(detail.runtime);
  const meta = [
    yearSpan(detail),
    isMovie ? runtime : detail.seasons ? plural(detail.seasons, 'season') : null,
    language,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="relative isolate">
      {detail.backdrop && !backdropFailed && (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[55vh] overflow-hidden">
          <img
            src={tmdbImage(detail.backdrop, 'w1280') ?? undefined}
            alt=""
            decoding="async"
            onError={() => setBackdropFailed(true)}
            className="h-full w-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-linear-to-b from-ground/30 to-ground" />
        </div>
      )}

      <div className="px-4 pt-6 sm:px-8">
        <BackLink />
        <div className={`mt-6 ${COLUMNS}`}>
          <div className={POSTER_COLUMN}>
            <div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-surface">
              <PosterImage
                path={detail.poster}
                title={detail.title}
                year={detail.year}
                variant="detail"
                sizes="(min-width: 1024px) 320px, (min-width: 768px) 288px, 208px"
                priority
              />
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-ink-muted text-sm">{typeLabel(detail)}</p>
            <h1
              className="mt-1 font-display font-semibold text-2xl sm:text-3xl"
              style={{ fontStretch: titleStretch(detail.title, 18) }}
            >
              {detail.title}
            </h1>
            {detail.originalTitle && (
              <p lang={detail.lang} className="mt-2 font-display text-ink-muted text-lg">
                {detail.originalTitle}
              </p>
            )}
            {meta && <p className="mt-3 text-sm">{meta}</p>}

            <div className="mt-6">
              <Scorecard
                record={record}
                pending={ratings.status === 'pending'}
                imdbId={detail.imdb}
                tmdbVote={detail.vote}
                tmdbVotes={detail.votes}
                tmdbUrl={`https://www.themoviedb.org/${detail.type}/${detail.id}`}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <WatchlistButton
                title={{ ...detail, scores: toCardScores(record ?? undefined) }}
                variant="primary"
              />
              {detail.trailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${encodeURIComponent(detail.trailer.key)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass('secondary')}
                >
                  Watch the trailer
                  <ExternalIcon className="size-4" />
                  <span className="sr-only">(opens YouTube)</span>
                </a>
              )}
            </div>

            {detail.tagline && (
              <p className="mt-10 font-display text-ink-muted text-lg">{detail.tagline}</p>
            )}
            {detail.overview ? (
              <p className={`measure text-base ${detail.tagline ? 'mt-3' : 'mt-10'}`}>
                {detail.overview}
              </p>
            ) : (
              <p className="mt-10 text-ink-muted">TMDB has no summary for this title yet.</p>
            )}

            <dl className="mt-10 grid max-w-2xl grid-cols-[9rem_minmax(0,1fr)] gap-x-6 gap-y-3 border-edge border-t pt-6 text-sm">
              {detail.releaseDate && (
                <Fact label={isMovie ? 'Released' : 'First aired'}>
                  {formatDate(detail.releaseDate)}
                </Fact>
              )}
              {runtime && <Fact label={isMovie ? 'Runtime' : 'Episode length'}>{runtime}</Fact>}
              {!isMovie && detail.seasons && (
                <Fact label="Seasons">
                  {plural(detail.seasons, 'season')}
                  {detail.episodes ? `, ${plural(detail.episodes, 'episode')}` : ''}
                </Fact>
              )}
              {detail.genreList.length > 0 && (
                <Fact label="Genres">
                  {detail.genreList.map((g, index) => {
                    const genre = genreForId(g.id, detail.type);
                    const separator = index < detail.genreList.length - 1 ? ', ' : '';
                    if (!genre) return <span key={g.id}>{`${g.name}${separator}`}</span>;
                    const search = detail.type === 'tv' && genre.movie !== null ? '?type=tv' : '';
                    return (
                      <span key={g.id}>
                        <Link
                          to={`/genre/${genre.slug}${search}`}
                          className="underline decoration-edge underline-offset-4 hover:decoration-ink"
                        >
                          {g.name}
                        </Link>
                        {separator}
                      </span>
                    );
                  })}
                </Fact>
              )}
              {language && <Fact label="Original language">{language}</Fact>}
              {detail.makers.length > 0 && (
                <Fact label={isMovie ? 'Directed by' : 'Created by'}>
                  {detail.makers.map((m) => m.name).join(', ')}
                </Fact>
              )}
            </dl>

            {detail.cast.length > 0 && (
              <section aria-labelledby="cast-heading" className="mt-12">
                <h2 id="cast-heading" className="font-display font-semibold text-lg">
                  Top-billed cast
                </h2>
                <ul className="mt-4 grid max-w-2xl gap-x-10 text-sm sm:grid-cols-2">
                  {detail.cast.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-baseline justify-between gap-4 border-edge border-b py-2"
                    >
                      <span>{member.name}</span>
                      <span className="truncate text-right text-ink-muted">{member.character}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Rail title="More like this" items={detail.recommendations} />
      </div>
    </article>
  );
}

function TitleSkeleton() {
  return (
    <div className="px-4 pt-6 sm:px-8" aria-busy="true">
      <div className="h-5" />
      <div className={`mt-6 ${COLUMNS}`}>
        <div className={POSTER_COLUMN}>
          <div className="aspect-[2/3] rounded-sm bg-surface" />
        </div>
        <div>
          <div className="h-5 w-16 bg-surface" />
          <div className="mt-2 h-12 w-3/4 bg-surface sm:h-16" />
          <div className="mt-4 h-5 w-48 bg-surface" />
        </div>
      </div>
    </div>
  );
}

function TitleView({ type, id }: { type: MediaType; id: number }) {
  const query = useTitle(type, id);
  const detail = query.data;
  useDocumentTitle(detail ? `${detail.title}${detail.year ? ` (${detail.year})` : ''}` : null);

  if (query.isPending) return <TitleSkeleton />;
  if (query.isError || !detail) {
    if (query.error instanceof TmdbError && query.error.status === 404) {
      return (
        <div className="px-4 sm:px-8">
          <Notice title={`TMDB has no ${type === 'movie' ? 'film' : 'series'} with ID ${id}.`}>
            The link may be wrong, or the entry was merged into another. Search for it by name
            instead.
          </Notice>
        </div>
      );
    }
    return (
      <div className="px-4 sm:px-8">
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  return <TitleContent detail={detail} />;
}

export default function TitlePage({ type }: { type: MediaType }) {
  const { id } = useParams();
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return <NotFound />;
  return <TitleView key={`${type}-${numericId}`} type={type} id={numericId} />;
}
