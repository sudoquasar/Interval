import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { cx } from '../lib/cx';
import { formatScore, titleStretch } from '../lib/format';
import { type TitleSummary, titlePath } from '../lib/model';
import { imdbTier, tierGlow, tierTextClass } from '../lib/scoreTier';
import { PosterImage } from './PosterImage';

export const RAIL_CARD_SIZES = '(min-width: 640px) 160px, 140px';
export const GRID_CARD_SIZES = '(min-width: 1280px) 180px, (min-width: 640px) 22vw, 45vw';

/** IMDb when the ratings index has it, TMDB otherwise; nothing when TMDB's score is noise. */
export function cardRating(
  item: TitleSummary,
): { value: string; source: 'IMDb' | 'TMDB'; raw: number } | null {
  if (item.scores?.i !== undefined) {
    return { value: formatScore(item.scores.i), source: 'IMDb', raw: item.scores.i };
  }
  if (item.votes >= 10 && item.vote > 0) {
    return { value: formatScore(item.vote), source: 'TMDB', raw: item.vote };
  }
  return null;
}

export function typeLabel(item: Pick<TitleSummary, 'type'>): string {
  return item.type === 'tv' ? 'Series' : 'Film';
}

/** The poster is the card. The score sits on its lower edge; the title is set beneath it. */
export function PosterCard({
  item,
  sizes = RAIL_CARD_SIZES,
  priority,
}: {
  item: TitleSummary;
  sizes?: string;
  priority?: boolean;
}) {
  const rating = cardRating(item);
  const tier = rating ? imdbTier(rating.raw) : null;
  const glowStyle = { '--glow': tier ? tierGlow(tier) : 'transparent' } as CSSProperties;

  return (
    <Link to={titlePath(item)} className="group block rounded-sm" style={glowStyle}>
      <div
        className={cx(
          'relative aspect-[2/3] overflow-hidden rounded-sm bg-surface',
          'transition-shadow duration-500 ease-out-expo',
          'group-hover:shadow-[0_20px_44px_-14px_var(--glow)]',
          'group-focus-visible:shadow-[0_20px_44px_-14px_var(--glow)]',
        )}
      >
        <PosterImage
          path={item.poster}
          title={item.title}
          year={item.year}
          sizes={sizes}
          priority={priority}
          imgClassName="transition-transform duration-700 ease-out-expo group-hover:scale-110"
        />
        <div className="absolute inset-x-0 bottom-0 flex h-7 items-baseline gap-1.5 bg-ground/80 px-2 pt-1">
          {rating ? (
            <>
              <span
                className={cx(
                  'font-bold font-display text-sm tabular-nums',
                  tier && tierTextClass(tier),
                )}
              >
                {rating.value}
              </span>
              <span className="text-ink-muted text-xs">{rating.source}</span>
            </>
          ) : (
            <span className="text-ink-muted text-xs">
              <span aria-hidden="true">—</span>
              <span className="sr-only">Not rated yet</span>
            </span>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="mt-2">
        <p
          className="line-clamp-2 h-[2.5em] font-display text-sm leading-[1.25] transition-colors duration-300 group-hover:text-marigold"
          style={{ fontStretch: titleStretch(item.title, 32) }}
        >
          {item.title}
        </p>
        <p className="mt-0.5 text-ink-muted text-xs">
          {item.year ? `${item.year} · ` : ''}
          {typeLabel(item)}
        </p>
      </div>
    </Link>
  );
}

/** Same box model as PosterCard, so swapping one for the other moves nothing. */
export function PosterCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="aspect-[2/3] rounded-sm bg-surface animate-shimmer" />
      <div className="mt-2">
        <p className="h-[2.5em] font-display text-sm leading-[1.25]">
          <span className="inline-block w-4/5 bg-surface text-transparent">&nbsp;</span>
        </p>
        <p className="mt-0.5 text-xs">
          <span className="inline-block w-1/3 bg-surface text-transparent">&nbsp;</span>
        </p>
      </div>
    </div>
  );
}
