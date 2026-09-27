import { useQuery } from '@tanstack/react-query';
import { app } from '../../config/app.config';
import { DATA_VERSION, fetchData } from './data';
import { isImdbId, type RatingRecord, type RatingShard, shardKey } from './ratings-format';

async function fetchShard(key: string, signal?: AbortSignal): Promise<RatingShard> {
  return (await fetchData<RatingShard>(`ratings/${key}.json`, signal)) ?? {};
}

export type RatingsState =
  | { status: 'none' }
  | { status: 'pending' }
  | { status: 'ready'; record: RatingRecord | null };

/**
 * Resolves a title's IMDb / RT / Metacritic scores from its shard. A shard is fetched once and
 * held in memory for the session, so every title that shares it resolves instantly. Shards are
 * never persisted to localStorage.
 */
export function useRatings(imdbId: string | null | undefined): RatingsState {
  const key = isImdbId(imdbId) ? shardKey(imdbId) : null;
  const query = useQuery({
    queryKey: ['ratings', key ?? 'none', DATA_VERSION],
    queryFn: ({ signal }) => fetchShard(key as string, signal),
    enabled: key !== null,
    staleTime: app.ratingsCacheTtlMinutes * 60_000,
    gcTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });

  if (key === null || !imdbId) return { status: 'none' };
  if (query.isPending) return { status: 'pending' };
  return { status: 'ready', record: query.data?.[imdbId] ?? null };
}
