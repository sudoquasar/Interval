import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { RAIL } from '../../lib/catalog-format';
import { cx } from '../../lib/cx';
import { formatScore, titleStretch } from '../../lib/format';
import { genreName } from '../../lib/genres';
import { tmdbImage } from '../../lib/images';
import { type TitleSummary, titlePath } from '../../lib/model';
import { useRail } from '../../lib/queries';
import { buttonClass } from '../../ui/Button';
import { typeLabel } from '../../ui/PosterCard';
import { WatchlistButton } from '../watchlist/WatchlistButton';

const FRAME =
  'relative isolate flex h-[68svh] max-h-[44rem] min-h-[26rem] items-end overflow-hidden';

/** Rotates daily through the top five trending titles that have art to show. */
export function pickHero(items: TitleSummary[], now = Date.now()): TitleSummary | null {
  const candidates = items.filter((item) => item.backdrop && item.overview).slice(0, 5);
  if (candidates.length === 0) return null;
  const day = Math.floor(now / 86_400_000);
  return candidates[day % candidates.length] ?? null;
}

function scoreLine(item: TitleSummary): string | null {
  const parts: string[] = [];
  if (item.scores?.i !== undefined) parts.push(`IMDb ${formatScore(item.scores.i)}`);
  if (item.scores?.rt !== undefined) parts.push(`Rotten Tomatoes ${item.scores.rt}%`);
  if (parts.length === 0 && item.votes >= 10) parts.push(`TMDB ${formatScore(item.vote)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * The one orchestrated motion on the site (PLAN.md §6.3): the backdrop resolves from a blurred
 * thumbnail to full size. Reduced-motion users get the swap without the fade.
 */
function Backdrop({ path }: { path: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const full = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = full.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <>
      {!failed && (
        <>
          <img
            src={tmdbImage(path, 'w300') ?? undefined}
            alt=""
            aria-hidden="true"
            onError={() => setFailed(true)}
            className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover blur-2xl"
          />
          <img
            ref={full}
            src={tmdbImage(path, 'w1280') ?? undefined}
            srcSet={`${tmdbImage(path, 'w780')} 780w, ${tmdbImage(path, 'w1280')} 1280w`}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cx(
              'absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-700 ease-out motion-reduce:transition-none',
              loaded ? 'animate-kenburns opacity-100' : 'opacity-0',
            )}
          />
        </>
      )}
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-ground via-ground/70 to-ground/0" />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-ground/80 to-ground/0 sm:via-ground/30" />
    </>
  );
}

export function Hero() {
  const { data, isPending } = useRail(RAIL.trending);
  const item = pickHero(data?.items ?? []);

  if (isPending) return <div className={cx(FRAME, 'bg-surface')} aria-hidden="true" />;
  if (!item?.backdrop) return null;

  const genres = item.genres
    .slice(0, 2)
    .map((id) => genreName(id, item.type))
    .filter(Boolean)
    .join(', ');
  const scores = scoreLine(item);

  return (
    <section aria-labelledby="hero-title" className={FRAME}>
      <Backdrop path={item.backdrop} />
      <div className="max-w-4xl px-4 pb-10 sm:px-8 sm:pb-14">
        <p className="animate-fade-up text-ink-muted text-sm">
          Trending this week · {typeLabel(item)}
        </p>
        <h2
          id="hero-title"
          className="mt-2 animate-fade-up font-display font-semibold text-2xl sm:text-3xl"
          style={{ fontStretch: titleStretch(item.title, 20), animationDelay: '80ms' }}
        >
          {item.title}
        </h2>
        <p className="mt-3 animate-fade-up text-sm" style={{ animationDelay: '140ms' }}>
          {[item.year, genres, scores].filter(Boolean).join(' · ')}
        </p>
        {item.overview && (
          <p
            className="mt-3 line-clamp-3 max-w-[60ch] animate-fade-up text-base text-ink/90"
            style={{ animationDelay: '200ms' }}
          >
            {item.overview}
          </p>
        )}
        <div
          className="mt-6 flex animate-fade-up flex-wrap items-center gap-3"
          style={{ animationDelay: '260ms' }}
        >
          <Link to={titlePath(item)} className={buttonClass('primary')}>
            See details
          </Link>
          <WatchlistButton title={item} />
        </div>
      </div>
    </section>
  );
}
