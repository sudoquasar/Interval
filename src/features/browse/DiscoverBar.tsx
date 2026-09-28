import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { app } from '../../../config/app.config';
import { accentHoverClass } from '../../lib/accents';
import { cx } from '../../lib/cx';
import { GENRES } from '../../lib/genres';
import type { MediaType, TitleSummary } from '../../lib/model';
import { useDiscoverPages } from '../../lib/queries';
import { fetchRatingsByImdbIds } from '../../lib/ratings';
import { type RatingRecord, toCardScores } from '../../lib/ratings-format';
import { getImdbId } from '../../lib/tmdb';
import { Notice } from '../../ui/Notice';
import { PosterGrid, PosterGridSkeleton } from '../../ui/PosterGrid';
import { QueryError } from '../../ui/QueryError';
import { MIN_RATINGS } from './filters';

const RT_THRESHOLDS = [50, 70, 90] as const;

/** A page of live discover results cross-referenced against each title's IMDb/RT scores. */
function useExternalRatings(type: MediaType, items: TitleSummary[] | undefined, enabled: boolean) {
  const ids = items?.map((item) => item.id) ?? [];
  return useQuery({
    queryKey: ['discover-ratings', type, ids] as const,
    queryFn: async ({ signal }) => {
      const list = items ?? [];
      const imdbIds = await Promise.all(
        list.map(async (item) => {
          try {
            return await getImdbId(type, item.id, signal);
          } catch {
            return null; // one title's lookup failing shouldn't sink the whole batch
          }
        }),
      );
      const ratings = await fetchRatingsByImdbIds(imdbIds, signal);
      return list.map((item, index) => {
        const imdbId = imdbIds[index];
        const record: RatingRecord | undefined = imdbId ? ratings.get(imdbId) : undefined;
        return { item, record };
      });
    },
    enabled: enabled && (items?.length ?? 0) > 0,
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * A home-page-top, multi-genre filter: pick any number of genres (OR'd together via TMDB's
 * `with_genres` pipe syntax) plus rating floors, and the curated rails below make way for a
 * live `/discover` grid. Clearing every genre brings the normal home page back.
 *
 * TMDB's own rating filters at the API level (`vote_average.gte`); IMDb and Rotten Tomatoes
 * scores don't exist in TMDB's data at all, so those two floors are applied client-side after
 * resolving each candidate's IMDb ID and looking it up in the same ratings shards the rest of
 * the app uses. That cross-reference can only narrow a page of results, never widen it, so a
 * second discover page is pulled in as extra candidates whenever either floor is active.
 */
export function DiscoverBar({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const [type, setType] = useState<MediaType>('movie');
  const [selected, setSelected] = useState<number[]>([]);
  const [minTmdb, setMinTmdb] = useState(0);
  const [minImdb, setMinImdb] = useState(0);
  const [minRt, setMinRt] = useState(0);

  const options = useMemo(() => GENRES.filter((g) => g[type] !== null), [type]);
  const active = selected.length > 0;
  const externalFilterActive = minImdb > 0 || minRt > 0;

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { sort_by: 'popularity.desc', page: 1 };
    if (selected.length > 0) p.with_genres = selected.join('|');
    if (minTmdb > 0) {
      p['vote_average.gte'] = minTmdb;
      p['vote_count.gte'] = app.minVoteCount;
    }
    return p;
  }, [selected, minTmdb]);

  const query = useDiscoverPages(type, params, externalFilterActive ? 2 : 1);
  const enrichment = useExternalRatings(
    type,
    query.data?.items,
    // Wait for the real (non-placeholder) page: toggling a floor changes the page count, so the
    // query briefly shows the previous, differently-sized page while the new one loads. Enriching
    // that placeholder would just be thrown away the moment the real data lands.
    active && externalFilterActive && !query.isPlaceholderData,
  );

  const results = useMemo(() => {
    if (!query.data) return undefined;
    if (!externalFilterActive) return query.data.items;
    if (!enrichment.data) return undefined;
    return enrichment.data
      .filter(({ record }) => {
        if (minImdb > 0 && (record?.i === undefined || record.i < minImdb)) return false;
        if (minRt > 0 && (record?.rt === undefined || record.rt < minRt)) return false;
        return true;
      })
      .map(({ item, record }) => {
        const scores = toCardScores(record);
        return scores ? { ...item, scores } : item;
      });
  }, [query.data, enrichment.data, externalFilterActive, minImdb, minRt]);

  const switchType = (next: MediaType) => {
    setType(next);
    setSelected([]);
  };

  const toggleGenre = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const resultsPending = query.isPending || (externalFilterActive && enrichment.isPending);
  const resultsError = query.isError ? query.error : enrichment.isError ? enrichment.error : null;
  const retry = () => {
    void query.refetch();
    if (externalFilterActive) void enrichment.refetch();
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
          <span className="text-ink-muted">TMDB at least</span>
          <select
            value={minTmdb}
            onChange={(event) => setMinTmdb(Number(event.target.value))}
            className="h-9 rounded-lg border border-edge bg-surface px-2 text-ink text-sm transition-colors hover:border-marigold/60"
          >
            <option value={0}>Any</option>
            {MIN_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}+
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">IMDb at least</span>
          <select
            value={minImdb}
            onChange={(event) => setMinImdb(Number(event.target.value))}
            className="h-9 rounded-lg border border-edge bg-surface px-2 text-ink text-sm transition-colors hover:border-marigold/60"
          >
            <option value={0}>Any</option>
            {MIN_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}+
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Rotten Tomatoes at least</span>
          <select
            value={minRt}
            onChange={(event) => setMinRt(Number(event.target.value))}
            className="h-9 rounded-lg border border-edge bg-surface px-2 text-ink text-sm transition-colors hover:border-marigold/60"
          >
            <option value={0}>Any</option>
            {RT_THRESHOLDS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}%+
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
          {resultsPending ? (
            <PosterGridSkeleton count={20} />
          ) : resultsError ? (
            <QueryError error={resultsError} onRetry={retry} />
          ) : results && results.length === 0 ? (
            <Notice title="Nothing clears that bar.">
              Drop a rating floor, or pick fewer genres at once — stacking genres with a strict IMDb
              or Rotten Tomatoes bar is a short list for a reason.
            </Notice>
          ) : results ? (
            <PosterGrid items={results} />
          ) : null}
        </div>
      )}
    </section>
  );
}
