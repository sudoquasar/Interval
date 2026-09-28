import { useQuery } from '@tanstack/react-query';
import { app } from '../../config/app.config';
import { DATA_VERSION, fetchData } from './data';
import { isImdbId, type RatingRecord, type RatingShard, shardKey } from './ratings-format';

async function fetchShard(key: string, signal?: AbortSignal): Promise<RatingShard> {
  return (await fetchData<RatingShard>(`ratings/${key}.json`, signal)) ?? {};
}

/**
 * Resolves ratings for a batch of IMDb IDs, fetching each distinct shard at most once. Used to
 * cross-reference a page of live TMDB results against IMDb/RT scores without a per-title round
 * trip to a separate endpoint — the shard is the only place those scores live.
 */
export async function fetchRatingsByImdbIds(
  imdbIds: ReadonlyArray<string | null>,
  signal?: AbortSignal,
): Promise<Map<string, RatingRecord>> {
  const shardKeys = new Set<string>();
  for (const id of imdbIds) {
    if (isImdbId(id)) shardKeys.add(shardKey(id));
  }
  const shards = new Map(
    await Promise.all(
      Array.from(shardKeys, async (key) => [key, await fetchShard(key, signal)] as const),
    ),
  );
  const result = new Map<string, RatingRecord>();
  for (const id of imdbIds) {
    if (!isImdbId(id)) continue;
    const record = shards.get(shardKey(id))?.[id];
    if (record) result.set(id, record);
  }
  return result;
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
