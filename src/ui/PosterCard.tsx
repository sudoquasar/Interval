import { Link } from 'react-router';
import { formatScore, titleStretch } from '../lib/format';
import { type TitleSummary, titlePath } from '../lib/model';
import { PosterImage } from './PosterImage';

export const RAIL_CARD_SIZES = '(min-width: 640px) 160px, 140px';
export const GRID_CARD_SIZES = '(min-width: 1280px) 180px, (min-width: 640px) 22vw, 45vw';

/** IMDb when the ratings index has it, TMDB otherwise; nothing when TMDB's score is noise. */
export function cardRating(item: TitleSummary): { value: string; source: 'IMDb' | 'TMDB' } | null {
  if (item.scores?.i !== undefined) return { value: formatScore(item.scores.i), source: 'IMDb' };
  if (item.votes >= 10 && item.vote > 0) return { value: formatScore(item.vote), source: 'TMDB' };
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
  return (
    <Link to={titlePath(item)} className="group block rounded-sm">
      <div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-surface">
        <PosterImage
          path={item.poster}
          title={item.title}
          year={item.year}
          sizes={sizes}
          priority={priority}
        />
        <div className="absolute inset-x-0 bottom-0 flex h-7 items-baseline gap-1.5 bg-ground/80 px-2 pt-1">
          {rating ? (
            <>
              <span className="font-bold font-display text-sm tabular-nums">{rating.value}</span>
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
          className="line-clamp-2 h-[2.5em] font-display text-sm leading-[1.25] group-hover:underline group-hover:underline-offset-2"
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

/** Same box model as PosterCard, so swapping one for the other moves nothing. Deliberately still. */
export function PosterCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="aspect-[2/3] rounded-sm bg-surface" />
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
