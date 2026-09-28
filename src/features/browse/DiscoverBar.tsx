import { useEffect, useMemo, useState } from 'react';
import { app } from '../../../config/app.config';
import { accentHoverClass } from '../../lib/accents';
import { cx } from '../../lib/cx';
import { GENRES } from '../../lib/genres';
import type { MediaType } from '../../lib/model';
import { useDiscover } from '../../lib/queries';
import { Notice } from '../../ui/Notice';
import { PosterGrid, PosterGridSkeleton } from '../../ui/PosterGrid';
import { QueryError } from '../../ui/QueryError';

const RATINGS = [6, 7, 8] as const;

/**
 * A home-page-top, multi-genre filter: pick any number of genres (OR'd together via TMDB's
 * `with_genres` pipe syntax) plus a rating floor, and the curated rails below make way for a
 * live `/discover` grid. Clearing every genre brings the normal home page back.
 */
export function DiscoverBar({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const [type, setType] = useState<MediaType>('movie');
  const [selected, setSelected] = useState<number[]>([]);
  const [minRating, setMinRating] = useState(0);

  const options = useMemo(() => GENRES.filter((g) => g[type] !== null), [type]);
  const active = selected.length > 0;

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { sort_by: 'popularity.desc', page: 1 };
    if (selected.length > 0) p.with_genres = selected.join('|');
    if (minRating > 0) {
      p['vote_average.gte'] = minRating;
      p['vote_count.gte'] = app.minVoteCount;
    }
    return p;
  }, [selected, minRating]);

  const query = useDiscover(type, params);

  const switchType = (next: MediaType) => {
    setType(next);
    setSelected([]);
  };

  const toggleGenre = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  return (
    <section aria-labelledby="discover-heading" className="mt-12 px-4 sm:px-8">
      <h2 id="discover-heading" className="font-display font-semibold text-lg">
        Build your own shortlist
      </h2>
      <p className="mt-1 text-ink-muted text-sm">
        Pick a mood (or several) and a bar to clear. We'll do the scrolling for you.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex h-9 rounded-lg border border-edge">
          {(['movie', 'tv'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchType(t)}
              aria-pressed={type === t}
              className={cx(
                'px-3 text-sm transition-colors duration-200',
                type === t ? 'bg-marigold text-on-accent' : 'text-ink-muted hover:text-ink',
              )}
            >
              {t === 'movie' ? 'Films' : 'Series'}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Rated at least</span>
          <select
            value={minRating}
            onChange={(event) => setMinRating(Number(event.target.value))}
            className="h-9 rounded-lg border border-edge bg-surface px-2 text-ink text-sm transition-colors hover:border-marigold/60"
          >
            <option value={0}>Any</option>
            {RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}+
              </option>
            ))}
          </select>
        </label>

        {active && (
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-ink-muted text-sm underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Clear genres
          </button>
        )}
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {options.map((genre, index) => {
          const id = genre[type];
          if (id === null) return null;
          const isSelected = selected.includes(id);
          return (
            <li key={genre.slug}>
              <button
                type="button"
                onClick={() => toggleGenre(id)}
                aria-pressed={isSelected}
                className={cx(
                  'rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 ease-snappy hover:scale-105',
                  isSelected
                    ? 'border-transparent bg-marigold text-on-accent'
                    : cx('border-edge text-ink-muted', accentHoverClass(index)),
                )}
              >
                {genre.name}
              </button>
            </li>
          );
        })}
      </ul>

      {active && (
        <div className="mt-6 animate-fade-up">
          {query.isPending ? (
            <PosterGridSkeleton count={20} />
          ) : query.isError ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : query.data && query.data.items.length === 0 ? (
            <Notice title="Nothing clears that bar.">
              Drop the rating floor, or pick fewer genres at once — three genres at 8+ is a short
              list for a reason.
            </Notice>
          ) : query.data ? (
            <PosterGrid items={query.data.items} />
          ) : null}
        </div>
      )}
    </section>
  );
}
